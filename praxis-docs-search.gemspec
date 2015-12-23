lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)

require 'praxis-docs-search/version'

Gem::Specification.new do |spec|
  spec.name          = "praxis-docs-search"
  spec.version       = PraxisDocsSearch::VERSION
  spec.authors       = ["Jakub Hampl"]
  spec.summary       = %q{Doc Browser Search plugin for Praxis.}
  spec.email         = ["jakub.hampl@rightscale.com"]

  spec.homepage = "https://github.com/rightscale/praxis-docs-search"
  spec.license = "MIT"
  spec.required_ruby_version = ">=2.1"

  spec.require_paths = ["lib"]
  spec.files         = `git ls-files -z`.split("\x0")
  spec.test_files    = spec.files.grep(%r{^(test|spec|features)/})

  spec.add_runtime_dependency 'praxis', [">= 0.18"]

  spec.add_development_dependency "bundler", "~> 1.6"
  spec.add_development_dependency "rake", "~> 0"

end
