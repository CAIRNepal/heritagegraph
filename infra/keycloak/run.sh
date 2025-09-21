docker run --name keycloak_auth \
  --link heritagegraph-db:heritagegraph-db \
  -p 8080:8080 \
  --env-file .env \
  keycloak-custom start
