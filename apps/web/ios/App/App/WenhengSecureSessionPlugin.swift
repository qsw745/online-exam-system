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
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDeletionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeDeletionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDeletionStatus", returnType: CAPPluginReturnPromise)
    ]

    private static let service = "top.qisw.wenheng.session"
    private static let account = "auth-session-v1"
    private static let deletionStatusAccount = "account-deletion-status-v1"

    private struct StoredSession: Codable {
        let accessToken: String
        let mode: String
        let expiresAt: Double?
    }

    private struct StoredDeletionStatus: Codable {
        let requestId: String
        let statusToken: String
    }

    private func keychainIdentity(account: String) -> [CFString: Any] {
        [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: Self.service,
            kSecAttrAccount: account
        ]
    }

    @objc public func read(_ call: CAPPluginCall) {
        var query = keychainIdentity(account: Self.account)
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
                keychainIdentity(account: Self.account) as CFDictionary,
                [kSecValueData: data] as CFDictionary
            )

            if updateStatus == errSecItemNotFound {
                var item = keychainIdentity(account: Self.account)
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
        let status = SecItemDelete(keychainIdentity(account: Self.account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Unable to clear secure session", "KEYCHAIN_CLEAR_FAILED")
            return
        }
        call.resolve()
    }

    @objc public func readDeletionStatus(_ call: CAPPluginCall) {
        var query = keychainIdentity(account: Self.deletionStatusAccount)
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve([:])
            return
        }
        guard status == errSecSuccess, let data = result as? Data else {
            call.reject("Unable to restore deletion status", "KEYCHAIN_DELETION_READ_FAILED")
            return
        }

        do {
            let credential = try JSONDecoder().decode(StoredDeletionStatus.self, from: data)
            call.resolve([
                "credential": [
                    "requestId": credential.requestId,
                    "statusToken": credential.statusToken
                ]
            ])
        } catch {
            call.reject("Deletion status data is invalid", "KEYCHAIN_DELETION_DECODE_FAILED")
        }
    }

    @objc public func writeDeletionStatus(_ call: CAPPluginCall) {
        guard let requestId = call.getString("requestId"),
              let uuid = UUID(uuidString: requestId),
              uuid.uuidString.lowercased() == requestId,
              let statusToken = call.getString("statusToken"),
              statusToken.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
            call.reject("Deletion status payload is invalid", "KEYCHAIN_DELETION_INVALID_PAYLOAD")
            return
        }

        do {
            let data = try JSONEncoder().encode(
                StoredDeletionStatus(requestId: requestId, statusToken: statusToken)
            )
            let identity = keychainIdentity(account: Self.deletionStatusAccount)
            let updateStatus = SecItemUpdate(
                identity as CFDictionary,
                [kSecValueData: data] as CFDictionary
            )

            if updateStatus == errSecItemNotFound {
                var item = identity
                item[kSecValueData] = data
                item[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
                guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else {
                    call.reject("Unable to save deletion status", "KEYCHAIN_DELETION_WRITE_FAILED")
                    return
                }
            } else if updateStatus != errSecSuccess {
                call.reject("Unable to save deletion status", "KEYCHAIN_DELETION_WRITE_FAILED")
                return
            }
            call.resolve()
        } catch {
            call.reject("Unable to encode deletion status", "KEYCHAIN_DELETION_ENCODE_FAILED")
        }
    }

    @objc public func clearDeletionStatus(_ call: CAPPluginCall) {
        let status = SecItemDelete(keychainIdentity(account: Self.deletionStatusAccount) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            call.reject("Unable to clear deletion status", "KEYCHAIN_DELETION_CLEAR_FAILED")
            return
        }
        call.resolve()
    }
}
