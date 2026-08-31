import AVFoundation
import Capacitor
import CoreImage
import UIKit
import Vision

@objc(WenhengProctoringPlugin)
public final class WenhengProctoringPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WenhengProctoringPlugin"
    public let jsName = "WenhengProctoring"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "permissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSensorPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureIdentityFrames", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise)
    ]

    private let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let audioOutput = AVCaptureAudioDataOutput()
    private let captureQueue = DispatchQueue(label: "top.qisw.wenheng.proctoring.capture", qos: .userInitiated)
    private let stateQueue = DispatchQueue(label: "top.qisw.wenheng.proctoring.state")
    private let ciContext = CIContext(options: [.cacheIntermediates: false])

    private var configured = false
    private var running = false
    private var interrupted = false
    private var latestFrames: [String] = []
    private var lastFrameStoredAt: TimeInterval = 0
    private var lastVisionAt: TimeInterval = 0
    private var faceCount = 0
    private var lightState = "normal"
    private var appState = "foreground"
    private var screenCaptured = false
    private var lastFactByType: [String: TimeInterval] = [:]
    private var observers: [NSObjectProtocol] = []

    public override func load() {
        super.load()
        installObservers()
        stateQueue.async {
            self.appState = UIApplication.shared.applicationState == .active ? "foreground" : "background"
            self.screenCaptured = UIScreen.main.isCaptured
        }
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }

    @objc public func permissionStatus(_ call: CAPPluginCall) {
        call.resolve(permissionPayload())
    }

    @objc public func requestSensorPermissions(_ call: CAPPluginCall) {
        let group = DispatchGroup()
        if AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined {
            group.enter()
            AVCaptureDevice.requestAccess(for: .video) { _ in group.leave() }
        }
        if AVCaptureDevice.authorizationStatus(for: .audio) == .notDetermined {
            group.enter()
            AVCaptureDevice.requestAccess(for: .audio) { _ in group.leave() }
        }
        group.notify(queue: .main) {
            call.resolve(self.permissionPayload())
        }
    }

    @objc public func start(_ call: CAPPluginCall) {
        guard AVCaptureDevice.authorizationStatus(for: .video) == .authorized else {
            call.reject("Camera permission is required for this strict exam", "PROCTORING_CAMERA_PERMISSION_REQUIRED")
            return
        }
        guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else {
            call.reject("Microphone permission is required for this strict exam", "PROCTORING_MICROPHONE_PERMISSION_REQUIRED")
            return
        }

        captureQueue.async {
            do {
                try self.configureSessionIfNeeded()
                guard !self.captureSession.inputs.isEmpty else {
                    throw NativeProctoringError.sensorUnavailable
                }
                if !self.captureSession.isRunning {
                    self.captureSession.startRunning()
                }
                self.stateQueue.sync {
                    self.running = self.captureSession.isRunning
                    self.interrupted = false
                }
                guard self.captureSession.isRunning else {
                    throw NativeProctoringError.sensorUnavailable
                }
                DispatchQueue.main.async {
                    self.emitFact("camera_restored")
                    self.emitFact("microphone_restored")
                    call.resolve(self.statusPayload())
                }
            } catch let error as NativeProctoringError {
                DispatchQueue.main.async { call.reject(error.message, error.code) }
            } catch {
                DispatchQueue.main.async {
                    call.reject("Unable to start strict proctoring sensors", "PROCTORING_START_FAILED")
                }
            }
        }
    }

    @objc public func status(_ call: CAPPluginCall) {
        call.resolve(statusPayload())
    }

    @objc public func captureIdentityFrames(_ call: CAPPluginCall) {
        let frames = stateQueue.sync { latestFrames }
        guard !frames.isEmpty else {
            call.reject("No camera frame is available for identity verification", "PROCTORING_IDENTITY_FRAME_UNAVAILABLE")
            return
        }
        call.resolve(["images": Array(frames.suffix(3))])
    }

    @objc public func stop(_ call: CAPPluginCall) {
        captureQueue.async {
            if self.captureSession.isRunning {
                self.captureSession.stopRunning()
            }
            self.stateQueue.sync {
                self.running = false
                self.interrupted = false
                self.latestFrames.removeAll(keepingCapacity: false)
                self.faceCount = 0
                self.lightState = "normal"
            }
            DispatchQueue.main.async { call.resolve() }
        }
    }

    @objc public func openSettings(_ call: CAPPluginCall) {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            call.reject("Unable to open system settings", "PROCTORING_SETTINGS_UNAVAILABLE")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                opened ? call.resolve() : call.reject("Unable to open system settings", "PROCTORING_SETTINGS_UNAVAILABLE")
            }
        }
    }

    private func configureSessionIfNeeded() throws {
        if configured { return }
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        captureSession.sessionPreset = .medium

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let microphone = AVCaptureDevice.default(for: .audio) else {
            throw NativeProctoringError.sensorUnavailable
        }
        let cameraInput = try AVCaptureDeviceInput(device: camera)
        let microphoneInput = try AVCaptureDeviceInput(device: microphone)
        guard captureSession.canAddInput(cameraInput), captureSession.canAddInput(microphoneInput) else {
            throw NativeProctoringError.sensorUnavailable
        }
        captureSession.addInput(cameraInput)
        captureSession.addInput(microphoneInput)

        videoOutput.alwaysDiscardsLateVideoFrames = true
        videoOutput.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
        ]
        videoOutput.setSampleBufferDelegate(self, queue: captureQueue)
        audioOutput.setSampleBufferDelegate(self, queue: captureQueue)
        guard captureSession.canAddOutput(videoOutput), captureSession.canAddOutput(audioOutput) else {
            throw NativeProctoringError.sensorUnavailable
        }
        captureSession.addOutput(videoOutput)
        captureSession.addOutput(audioOutput)
        if let connection = videoOutput.connection(with: .video), connection.isVideoMirroringSupported {
            connection.automaticallyAdjustsVideoMirroring = false
            connection.isVideoMirrored = true
        }
        configured = true
    }

    private func permissionPayload() -> [String: Any] {
        [
            "camera": permissionName(AVCaptureDevice.authorizationStatus(for: .video)),
            "microphone": permissionName(AVCaptureDevice.authorizationStatus(for: .audio))
        ]
    }

    private func permissionName(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "granted"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "prompt"
        @unknown default: return "unavailable"
        }
    }

    private func statusPayload() -> [String: Any] {
        let snapshot = stateQueue.sync {
            (
                running,
                interrupted,
                faceCount,
                lightState,
                appState,
                screenCaptured
            )
        }
        let cameraPermission = permissionName(AVCaptureDevice.authorizationStatus(for: .video))
        let microphonePermission = permissionName(AVCaptureDevice.authorizationStatus(for: .audio))
        return [
            "running": snapshot.0,
            "camera": cameraPermission == "granted" ? (snapshot.0 && !snapshot.1 ? "available" : "interrupted") : "denied",
            "microphone": microphonePermission == "granted" ? (snapshot.0 && !snapshot.1 ? "available" : "interrupted") : "denied",
            "app": snapshot.4,
            "faceCount": min(2, max(0, snapshot.2)),
            "light": snapshot.3,
            "screenCaptured": snapshot.5,
            "storesAudio": false,
            "uploadsContinuousMedia": false
        ]
    }

    private func installObservers() {
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: .AVCaptureSessionWasInterrupted, object: captureSession, queue: .main) { [weak self] _ in
            self?.stateQueue.async { self?.interrupted = true }
            self?.emitFact("camera_interrupted")
            self?.emitFact("microphone_interrupted")
        })
        observers.append(center.addObserver(forName: .AVCaptureSessionInterruptionEnded, object: captureSession, queue: .main) { [weak self] _ in
            self?.stateQueue.async { self?.interrupted = false }
            self?.emitFact("camera_restored")
            self?.emitFact("microphone_restored")
        })
        observers.append(center.addObserver(forName: .AVCaptureSessionRuntimeError, object: captureSession, queue: .main) { [weak self] _ in
            self?.stateQueue.async { self?.interrupted = true }
            self?.emitFact("camera_interrupted")
            self?.emitFact("microphone_interrupted")
        })
        observers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.stateQueue.async { self?.appState = "background" }
            self?.emitFact("app_backgrounded")
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.stateQueue.async { self?.appState = "foreground" }
            self?.emitFact("app_foregrounded")
        })
        observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
            let captured = UIScreen.main.isCaptured
            self?.stateQueue.async { self?.screenCaptured = captured }
            self?.emitFact(captured ? "screen_capture_started" : "screen_capture_stopped")
        })
    }

    private func emitFact(_ type: String) {
        let now = Date().timeIntervalSince1970
        let shouldEmit = stateQueue.sync { () -> Bool in
            let previous = lastFactByType[type] ?? 0
            if now - previous < 1.5 { return false }
            lastFactByType[type] = now
            return true
        }
        guard shouldEmit else { return }
        notifyListeners("proctoringFact", data: [
            "type": type,
            "occurredAt": ISO8601DateFormatter().string(from: Date()),
            "state": statusPayload()
        ])
    }

    private func handleVideoFrame(_ sampleBuffer: CMSampleBuffer) {
        let now = Date().timeIntervalSince1970
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        if now - lastFrameStoredAt >= 0.75 {
            lastFrameStoredAt = now
            let image = CIImage(cvPixelBuffer: pixelBuffer).oriented(.leftMirrored)
            if let data = ciContext.jpegRepresentation(
                of: image,
                colorSpace: CGColorSpaceCreateDeviceRGB(),
                options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.72]
            ) {
                let frame = "data:image/jpeg;base64,\(data.base64EncodedString())"
                stateQueue.sync {
                    latestFrames.append(frame)
                    if latestFrames.count > 3 { latestFrames.removeFirst(latestFrames.count - 3) }
                }
            }
        }

        guard now - lastVisionAt >= 1.0 else { return }
        lastVisionAt = now
        let request = VNDetectFaceRectanglesRequest()
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .leftMirrored)
        let detectedFaces: Int
        do {
            try handler.perform([request])
            detectedFaces = min(2, request.results?.count ?? 0)
        } catch {
            detectedFaces = 0
        }
        let light = averageLuminance(pixelBuffer) < 0.16 ? "dark" : "normal"
        let previous = stateQueue.sync { () -> (Int, String) in
            let old = (faceCount, lightState)
            faceCount = detectedFaces
            lightState = light
            return old
        }
        if previous.0 != detectedFaces {
            if detectedFaces == 0 { emitFact("face_missing") }
            if detectedFaces >= 2 { emitFact("multiple_faces") }
        }
        if previous.1 != light && light == "dark" { emitFact("camera_obscured") }
    }

    private func averageLuminance(_ pixelBuffer: CVPixelBuffer) -> Double {
        CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return 0 }
        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer)
        let bytes = base.assumingMemoryBound(to: UInt8.self)
        var sum = 0.0
        var count = 0
        let step = 24
        for y in stride(from: 0, to: height, by: step) {
            for x in stride(from: 0, to: width, by: step) {
                let offset = y * bytesPerRow + x * 4
                let blue = Double(bytes[offset])
                let green = Double(bytes[offset + 1])
                let red = Double(bytes[offset + 2])
                sum += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255.0
                count += 1
            }
        }
        return count > 0 ? sum / Double(count) : 0
    }
}

extension WenhengProctoringPlugin: AVCaptureVideoDataOutputSampleBufferDelegate, AVCaptureAudioDataOutputSampleBufferDelegate {
    public func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        if output === videoOutput { handleVideoFrame(sampleBuffer) }
        // 音频轨道只用于确认设备和采集管线持续可用；不读取、分析、保存或上传样本内容。
    }
}

private enum NativeProctoringError: Error {
    case sensorUnavailable

    var code: String { "PROCTORING_SENSOR_UNAVAILABLE" }
    var message: String { "Required proctoring camera or microphone is unavailable" }
}
