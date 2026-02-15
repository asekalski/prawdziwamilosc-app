puts "Ruby Version: #{RUBY_VERSION}"
puts "Ruby Platform: #{RUBY_PLATFORM}"
puts "GEM_HOME: #{Gem.dir}"
puts "GEM_PATH: #{Gem.path}"
begin
  require 'bigdecimal'
  puts "Successfully required bigdecimal"
rescue LoadError => e
  puts "Failed to require bigdecimal: #{e.message}"
end
