use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Unified application error type.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Invalid request: {0}")]
    BadRequest(String),

    #[error("Database error: {0}")]
    Database(#[from] mongodb::error::Error),

    #[error("Serialisation error: {0}")]
    Serialisation(#[from] bson::ser::Error),

    #[error("Value access error: {0}")]
    ValueAccess(#[from] bson::document::ValueAccessError),

    #[error("Internal server error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "NOT_FOUND", msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "BAD_REQUEST", msg.clone()),
            AppError::Database(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "DATABASE_ERROR",
                e.to_string(),
            ),
            AppError::Serialisation(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "SERIALISATION_ERROR",
                e.to_string(),
            ),
            AppError::ValueAccess(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "VALUE_ACCESS_ERROR",
                e.to_string(),
            ),
            AppError::Internal(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                e.to_string(),
            ),
        };

        tracing::error!(code, message, "Request error");

        let body = Json(json!({
            "error": {
                "code": code,
                "message": message,
            }
        }));

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
