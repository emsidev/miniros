Pod::Spec.new do |s|
  s.name = 'MinirosPeer'
  s.version = '0.1.0'
  s.summary = 'Isolated EP02 Nearby Connections candidate for MINIROS'
  s.description = 'Native test-envelope transport; production feasibility remains device gated.'
  s.license = { :type => 'Proprietary' }
  s.author = 'MINIROS'
  s.homepage = 'https://developers.google.com/nearby/connections/overview'
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
