class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  before_create do
    self.id ||= SecureRandom.uuid if self.class.attribute_types[self.class.primary_key]&.type == :string
  end
end
