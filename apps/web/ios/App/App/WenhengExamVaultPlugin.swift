import Capacitor
import CryptoKit
import Foundation
import Security

@objc(WenhengExamVaultPlugin)
public final class WenhengExamVaultPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WenhengExamVaultPlugin"
    public let jsName = "WenhengExamVault"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uptime", returnType: CAPPluginReturnPromise)
    ]

    private static let keychainService = "top.qisw.wenheng.exam-vault"
    private static let keychainAccount = "exam-vault-key-v1"
    private static let directoryName = "WenhengExamVault"

    private var keychainIdentity: [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.keychainService,
            kSecAttrAccount: Self.keychainAccount
        ]
    }

    private func validatedKey(_ call: CAPPluginCall) throws -> String {
        guard let key = call.getString("key"), !key.isEmpty, key.utf8.count <= 512 else {
            throw VaultError.invalidKey
        }
        return key
    }

    private func vaultDirectory() throws -> URL {
        let root = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = root.appendingPathComponent(Self.directoryName, isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        )
        return directory
    }

    private func fileURL(for key: String) throws -> URL {
        let digest = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
        return try vaultDirectory().appendingPathComponent("\(digest).vault", isDirectory: false)
    }

    private func loadOrCreateEncryptionKey() throws -> SymmetricKey {
        var query = keychainIdentity
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne

        var result: CFTypeRef?
        let readStatus = SecItemCopyMatching(query as CFDictionary, &result)
        if readStatus == errSecSuccess, let data = result as? Data, data.count == 32 {
            return SymmetricKey(data: data)
        }
        guard readStatus == errSecItemNotFound else { throw VaultError.keychainFailure }

        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw VaultError.keyGenerationFailure
        }
        let data = Data(bytes)
        var item = keychainIdentity
        item[kSecValueData] = data
        item[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else {
            throw VaultError.keychainFailure
        }
        return SymmetricKey(data: data)
    }

    @objc public func read(_ call: CAPPluginCall) {
        do {
            let url = try fileURL(for: validatedKey(call))
            guard FileManager.default.fileExists(atPath: url.path) else {
                call.resolve([:])
                return
            }
            let encrypted = try Data(contentsOf: url)
            let sealed = try AES.GCM.SealedBox(combined: encrypted)
            let cleartext = try AES.GCM.open(sealed, using: loadOrCreateEncryptionKey())
            guard let value = String(data: cleartext, encoding: .utf8) else {
                throw VaultError.invalidPayload
            }
            call.resolve(["value": value])
        } catch let error as VaultError {
            call.reject(error.message, error.code)
        } catch {
            call.reject("Unable to restore encrypted exam draft", "EXAM_VAULT_READ_FAILED")
        }
    }

    @objc public func write(_ call: CAPPluginCall) {
        do {
            let url = try fileURL(for: validatedKey(call))
            guard let value = call.getString("value") else { throw VaultError.invalidPayload }
            let sealed = try AES.GCM.seal(Data(value.utf8), using: loadOrCreateEncryptionKey())
            guard let combined = sealed.combined else { throw VaultError.invalidPayload }
            try combined.write(to: url, options: .atomic)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                ofItemAtPath: url.path
            )
            call.resolve()
        } catch let error as VaultError {
            call.reject(error.message, error.code)
        } catch {
            call.reject("Unable to save encrypted exam draft", "EXAM_VAULT_WRITE_FAILED")
        }
    }

    @objc public func remove(_ call: CAPPluginCall) {
        do {
            let url = try fileURL(for: validatedKey(call))
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
            call.resolve()
        } catch let error as VaultError {
            call.reject(error.message, error.code)
        } catch {
            call.reject("Unable to remove encrypted exam draft", "EXAM_VAULT_REMOVE_FAILED")
        }
    }

    @objc public func uptime(_ call: CAPPluginCall) {
        call.resolve(["milliseconds": ProcessInfo.processInfo.systemUptime * 1000])
    }
}

private enum VaultError: Error {
    case invalidKey
    case invalidPayload
    case keyGenerationFailure
    case keychainFailure

    var code: String {
        switch self {
        case .invalidKey: return "EXAM_VAULT_INVALID_KEY"
        case .invalidPayload: return "EXAM_VAULT_INVALID_PAYLOAD"
        case .keyGenerationFailure: return "EXAM_VAULT_KEY_GENERATION_FAILED"
        case .keychainFailure: return "EXAM_VAULT_KEYCHAIN_FAILED"
        }
    }

    var message: String {
        switch self {
        case .invalidKey: return "Exam draft key is invalid"
        case .invalidPayload: return "Exam draft payload is invalid"
        case .keyGenerationFailure: return "Unable to create exam vault key"
        case .keychainFailure: return "Unable to access exam vault key"
        }
    }
}
