// iOS system color picker for the app's Palette (L3 "more colors" escalation).
//
// Why a native module: UIColorPickerViewController is the platform's own
// full-gamut picker (grid, spectrum, sliders, opacity, eyedropper) — the iOS
// counterpart of the web's <input type="color" alpha>. React Native does not
// expose it, and Android has no system picker at all, which is why this
// module is iOS-only (docs/platform-decisions.md #6).
//
// Contract with JS (src/components/palette/native-picker.ios.ts):
//   pick(initialHex, title) → Promise<String>  the final color as #rrggbb[aa],
//                                              resolved once when the picker is
//                                              dismissed (the web's `change`)
//   event "onPreview" { value }                every intermediate selection
//                                              (the web's `input`)
// JS normalizes the string with parseHexColor, so formatting here only has to
// be a valid hex.
//
// NOTE ON VERIFICATION: like the voice plugin, this compiles only in a real
// iOS build (`expo prebuild` + Xcode). It has not been built in CI.

import ExpoModulesCore
import UIKit

public class NativeColorPickerModule: Module {
  /// The in-flight picker. Held strongly: UIKit keeps its delegate weak.
  private var session: PickerSession?

  public func definition() -> ModuleDefinition {
    Name("NativeColorPicker")

    Events("onPreview")

    AsyncFunction("pick") { (initialHex: String, title: String, promise: Promise) in
      guard self.session == nil else {
        promise.reject("E_BUSY", "A color picker is already open")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_NO_PRESENTER", "No view controller to present the color picker from")
        return
      }

      let picker = UIColorPickerViewController()
      picker.title = title
      picker.supportsAlpha = true
      picker.selectedColor = UIColor(hex: initialHex) ?? .black

      let session = PickerSession(
        promise: promise,
        onPreview: { [weak self] hex in self?.sendEvent("onPreview", ["value": hex]) },
        onEnd: { [weak self] in self?.session = nil }
      )
      self.session = session
      picker.delegate = session
      // Swipe-to-dismiss ends the session too (not every iOS version reports
      // it through colorPickerViewControllerDidFinish).
      picker.presentationController?.delegate = session

      presenter.present(picker, animated: true)
    }.runOnQueue(.main)
  }
}

/// Bridges one picker presentation to one promise; resolves exactly once.
private final class PickerSession: NSObject, UIColorPickerViewControllerDelegate,
  UIAdaptivePresentationControllerDelegate
{
  private var promise: Promise?
  private let onPreview: (String) -> Void
  private let onEnd: () -> Void

  init(promise: Promise, onPreview: @escaping (String) -> Void, onEnd: @escaping () -> Void) {
    self.promise = promise
    self.onPreview = onPreview
    self.onEnd = onEnd
  }

  func colorPickerViewController(
    _ viewController: UIColorPickerViewController,
    didSelect color: UIColor,
    continuously: Bool
  ) {
    onPreview(color.hexString)
  }

  func colorPickerViewControllerDidFinish(_ viewController: UIColorPickerViewController) {
    finish(with: viewController.selectedColor)
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    guard let picker = presentationController.presentedViewController as? UIColorPickerViewController
    else { return }
    finish(with: picker.selectedColor)
  }

  private func finish(with color: UIColor) {
    guard let promise else { return }
    self.promise = nil
    promise.resolve(color.hexString)
    onEnd()
  }
}

private extension UIColor {
  /// Parses #rrggbb or #rrggbbaa (what the JS side always sends).
  convenience init?(hex: String) {
    var digits = hex.trimmingCharacters(in: .whitespaces)
    if digits.hasPrefix("#") { digits.removeFirst() }
    guard digits.count == 6 || digits.count == 8, let value = UInt64(digits, radix: 16) else {
      return nil
    }
    let hasAlpha = digits.count == 8
    let rgb = hasAlpha ? value >> 8 : value
    self.init(
      red: CGFloat((rgb >> 16) & 0xff) / 255,
      green: CGFloat((rgb >> 8) & 0xff) / 255,
      blue: CGFloat(rgb & 0xff) / 255,
      alpha: hasAlpha ? CGFloat(value & 0xff) / 255 : 1
    )
  }

  /// sRGB hex, alpha pair only when translucent. Wide-gamut (P3) picks are
  /// clamped to sRGB — the app's canonical color format is sRGB hex.
  var hexString: String {
    let srgb = cgColor.converted(
      to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil
    ) ?? cgColor
    let parts = srgb.components ?? [0, 0, 0, 1]
    // Grayscale colors come back as [white, alpha].
    let rgba = parts.count >= 4 ? parts : [parts[0], parts[0], parts[0], parts.last ?? 1]
    func byte(_ component: CGFloat) -> Int { Int((min(max(component, 0), 1) * 255).rounded()) }
    let rgb = String(format: "#%02x%02x%02x", byte(rgba[0]), byte(rgba[1]), byte(rgba[2]))
    let alpha = byte(rgba[3])
    return alpha == 255 ? rgb : rgb + String(format: "%02x", alpha)
  }
}
