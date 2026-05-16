from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Oxigraph server
    oxigraph_url: str = "http://localhost:7878"
    oxigraph_timeout: float = 30.0

    # Ontology — path to the project's canonical OWL/Turtle file.
    # Changing this file is the only step needed when the ontology evolves.
    # Heritage.ttl (repo root) uses the heritageGraph: namespace (https://w3id.org/heritagegraph/).
    ontology_path: Path = Path("../Heritage.ttl")

    # Data
    base_uri: str = "https://heritagegraph.org/"
    shapes_dir: Path = Path("shapes")
    validate_on_ingest: bool = True


settings = Settings()
