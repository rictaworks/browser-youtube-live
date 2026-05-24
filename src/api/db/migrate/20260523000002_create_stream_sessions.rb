class CreateStreamSessions < ActiveRecord::Migration[7.2]
  def change
    create_table :stream_sessions, id: :uuid, force: :cascade do |t|
      t.references :user,          null: false, foreign_key: true, type: :uuid
      t.string     :broadcast_id
      t.text       :stream_key
      t.string     :rtmp_url
      t.string     :status,        null: false, default: 'created'
      t.string     :quality,       null: false, default: '720p'
      t.datetime   :started_at
      t.datetime   :ended_at
      t.integer    :duration_sec
      t.integer    :max_viewers
      t.text       :error_message
      t.timestamps
    end

    add_index :stream_sessions, :status
  end
end
