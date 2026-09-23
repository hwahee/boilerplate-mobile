# Local Expo module (autolinked from apps/mobile/modules/) — see
# NativeColorPickerModule.swift and docs/palette-mobile.md.
Pod::Spec.new do |s|
  s.name           = 'NativeColorPicker'
  s.version        = '1.0.0'
  s.summary        = 'Presents the iOS system color picker (UIColorPickerViewController).'
  s.description    = 'Escalation path of the app Palette component: the full-gamut system picker with opacity.'
  s.license        = 'MIT'
  s.author         = 'boilerplate-mobile'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
