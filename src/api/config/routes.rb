Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  # OmniAuth コールバック（/auth/google → /auth/google/callback）
  get "/auth/google/callback", to: "auth/omniauth_callbacks#google_oauth2"

  namespace :auth do
    get    "me",      to: "sessions#me"
    delete "sign_out", to: "sessions#destroy"
  end

  resources :quality_presets, only: [ :index ]

  resources :stream_sessions, only: [ :create, :index ] do
    member do
      patch :end
      get   :stats
      post  :recover
    end
  end
end
