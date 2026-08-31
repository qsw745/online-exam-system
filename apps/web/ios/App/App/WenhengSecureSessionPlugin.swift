import Capacitor
import Foundation
import Security

@objc(WenhengSecureSessionPlugin)
public final class WenhengSecureSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WenhengSecureSessionPlugin"
    public let jsName = "WenhengSecureSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    private static let service = "top.qisw.wenheng.session"
    private static let account = "auth-session-v1"

    private struct StoredSession: Codable {
        let accessToken: String
        let mode: String
        let expiresAt: Double?
    }

    private var keychainIdentity: [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: Self.account
        ]
    }

    @objc public func read(_ call: CAPPluginCall) {
        var query = keychainIdentity
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve([:])
            return
        }
        guard status == errSecSuccess, let data = result as? Data else {
            call.reject("Unable to restore secure session", "KEYCHAIN_READ_FAILED")
            return
        }

        do {
            let session = try JSONDecoder().decode(StoredSession.self, from: data)
            var payload: [String: Any] = [
                "accessToken": session.accessToken,
                "mode": session.mode
            ]
            payload["expiresAt"] = session.expiresAt ?? NSNull()
            call.resolve([
                "session": payload
            ])
        } catch {
            call.reject("Secure session data is invalid", "KEYCHAIN_DECODE_FAILED")
        }
    }

    @objc public func write(_ call: CAPPluginCall) {
        guard let accessToken = call.getString("accessToken"), !accessToken.isEmpty,
              let mode = call.getString("mode"), ["session", "local", "7d"].contains(mode) else {
            call.reject("Secure session payload is invalid", "KEYCHAIN_INVALID_PAYLOAD")
            return
        }

        do {
            let data = try JSONEncoder().encode(
                StoredSession(accessToken: accessToken, mode: mode, expiresAt: call.getDouble("expiresAt"))
            )
            let updateStatus = SecItemUpdate(
                keychainIdentity as CFDictionary,
                [kSecValueData: data] as CFDictionary
            )

            if updateStatus == errSecItemNotFound {
                var item = keychainIdentity
                item[kSecValueData] = data
                item[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                let addStatus = SecItemAdd(item as CFDictionary, nil)
                guard addStatus == errSecSuccess else {
                    call.reject("Unable to save secure session", "KEYCHAIN_WRITE_FAILED")
                    return
                }
            } else if updateStatus != errSecSuccess {
                call.reject("Unable to save secure session", "KEYCHAIN_WRITE_FAILED")
                return
            }

            call.resolve()
        } catch {
            call.reject("Unable to encode secure session", "KEYCHAIN_ENCODE_FAILED")
        }
    }

    @objc public func clear(_ call: CAPPluginCall) {
        let status = SecItemDelete(keychainIdentity as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Unable to clear secure session", "KEYCHAIN_CLEAR_FAILED")
            return
        }
        call.resolve()
    }
}
