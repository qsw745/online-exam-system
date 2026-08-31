import Capacitor
import UIKit

final class WenhengBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(WenhengSecureSessionPlugin())
        bridge?.registerPluginInstance(WenhengExamVaultPlugin())
        bridge?.registerPluginInstance(WenhengProctoringPlugin())
    }
}
