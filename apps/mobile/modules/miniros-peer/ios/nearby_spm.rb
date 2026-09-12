# CocoaPods integration hook for Google's official SwiftPM-only SDK.
# Called after CocoaPods regeneration; repeatable and pinned to one reviewed source snapshot.
module MinirosNearby
  URL = 'https://github.com/google/nearby.git'.freeze
  REVISION = '46f8ffd1ba2253659296d07aeee46666add7cd25'.freeze
  def self.install(project)
    target = project.targets.find { |item| item.name == 'MinirosPeer' }
    raise 'MinirosPeer native target missing; inspect Expo module autolinking' unless target
    package = project.root_object.package_references.find { |item| item.is_a?(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference) && item.repositoryURL == URL }
    unless package
      package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
      package.repositoryURL = URL
      project.root_object.package_references << package
    end
    package.requirement = { 'kind' => 'revision', 'revision' => REVISION }
    product = target.package_product_dependencies.find { |item| item.product_name == 'NearbyConnections' }
    unless product
      product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
      product.package = package
      product.product_name = 'NearbyConnections'
      target.package_product_dependencies << product
      build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
      build_file.product_ref = product
      target.frameworks_build_phase.files << build_file
    end
    target.build_configurations.each do |configuration|
      conditions = configuration.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] || '$(inherited)'
      conditions = conditions.join(' ') if conditions.is_a?(Array)
      configuration.build_settings['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = "#{conditions} MINIROS_EP02_PEER" unless conditions.split.include?('MINIROS_EP02_PEER')
    end
    project.save
  end
end
