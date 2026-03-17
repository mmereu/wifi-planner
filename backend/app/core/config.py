from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://hamina_user:Hamina2024!Secure@postgres:5432/hamina"
    secret_key: str = "hamina-secret"
    upload_dir: str = "/app/uploads"
    max_upload_size: int = 104857600
    minio_endpoint: str = "minio:9000"
    minio_root_user: str = "hamina_minio"
    minio_root_password: str = "Hamina2024!Minio"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
