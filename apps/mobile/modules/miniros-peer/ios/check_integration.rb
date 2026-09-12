# Portable check of Xcodeproj object wiring, not an Xcode/native compilation test.
require 'tmpdir'
require 'xcodeproj'
require_relative 'nearby_spm'
Dir.mktmpdir('miniros-ep02-xcodeproj-') do |dir|
  path = File.join(dir, 'Pods.xcodeproj')
  project = Xcodeproj::Project.new(path)
  project.new_target(:static_library, 'MinirosPeer', :ios, '16.4')
  MinirosNearby.install(project)
  MinirosNearby.install(project)
  saved = Xcodeproj::Project.open(path)
  target = saved.targets.find { |item| item.name == 'MinirosPeer' }
  raise 'Duplicate/missing package reference' unless saved.root_object.package_references.length == 1
  raise 'Duplicate/missing target product dependency' unless target.package_product_dependencies.length == 1
  product = target.package_product_dependencies.first
  raise 'Wrong product' unless product.product_name == 'NearbyConnections'
  raise 'SDK is not revision pinned' unless product.package.requirement == { 'kind' => 'revision', 'revision' => MinirosNearby::REVISION }
  raise 'Missing target linkage' unless target.frameworks_build_phase.files.count { |file| file.product_ref == product } == 1
  target.build_configurations.each do |configuration|
    raise 'Missing/duplicate native compilation guard' unless configuration.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'].split.count('MINIROS_EP02_PEER') == 1
  end
  puts 'PASS: pinned package, actual pod target, product linkage, compile guard, save/reopen and idempotence (6 assertions)'
end
