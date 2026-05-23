class CreateQualityPresets < ActiveRecord::Migration[7.2]
  def change
    create_table :quality_presets, id: :uuid, force: :cascade do |t|
      t.string  :name,    null: false
      t.integer :width,   null: false
      t.integer :height,  null: false
      t.integer :fps,     null: false
      t.integer :bitrate, null: false
      t.string  :codec,   null: false
      t.timestamps
    end

    add_index :quality_presets, :name, unique: true
  end
end
