FROM node:18-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./

# Instalar dependencias
RUN npm install --only=production

# Copiar código fuente
COPY src ./src

# Compilar TypeScript
RUN npm run build

# El paquete común no tiene entrada, solo se usa como librería 