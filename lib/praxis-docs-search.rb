module Praxis
  class DocsSearch < ::Praxis::Plugin
    include Singleton
    def setup!
      register_doc_browser_plugin File.join(File.dirname(__FILE__), 'api_browser')
    end

    def config_key
      :docs_search
    end
  end
end
