FROM node:22.23.1-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.client.json eslint.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    PORT=10000
WORKDIR /app
RUN addgroup --system atlas && adduser --system --ingroup atlas atlas
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY --from=frontend /app/dist/client ./dist/client
USER atlas
EXPOSE 10000
CMD ["python", "-m", "backend.app"]
