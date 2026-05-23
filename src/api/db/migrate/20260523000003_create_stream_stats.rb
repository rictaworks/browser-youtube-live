class CreateStreamStats < ActiveRecord::Migration[7.2]
  def change
    create_table :stream_stats, id: :uuid, force: :cascade do |t|
      t.references :stream_session, null: false, foreign_key: true, type: :uuid
      t.datetime   :recorded_at,    null: false
      t.integer    :bitrate_kbps
      t.decimal    :fps,            precision: 5, scale: 2
      t.integer    :dropped_frames
      t.integer    :viewer_count
      t.integer    :buffer_size_kb
    end

    add_index :stream_stats, :recorded_at
  end
end
