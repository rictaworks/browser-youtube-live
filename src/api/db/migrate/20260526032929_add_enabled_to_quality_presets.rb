class AddEnabledToQualityPresets < ActiveRecord::Migration[7.2]
  def change
    add_column :quality_presets, :enabled, :boolean, null: false, default: false
  end
end
