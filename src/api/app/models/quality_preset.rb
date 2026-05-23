class QualityPreset < ApplicationRecord
  validates :name,    presence: true, uniqueness: true
  validates :width,   presence: true, numericality: { greater_than: 0 }
  validates :height,  presence: true, numericality: { greater_than: 0 }
  validates :fps,     presence: true, numericality: { greater_than: 0 }
  validates :bitrate, presence: true, numericality: { greater_than: 0 }
  validates :codec,   presence: true
end
