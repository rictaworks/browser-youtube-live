class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users, id: :uuid, force: :cascade do |t|
      t.string   :email,         null: false
      t.string   :name,          null: false
      t.string   :google_id,     null: false
      t.text     :youtube_token
      t.datetime :token_expiry
      t.timestamps
    end

    add_index :users, :email,     unique: true
    add_index :users, :google_id, unique: true
  end
end
