# Usar Node.js LTS como imagen base
FROM node:18-alpine

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json (si existe)
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Generar el cliente de Prisma
RUN npx prisma generate

# Exponer el puerto
EXPOSE 3000

# Crear un usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Cambiar ownership de los archivos
RUN chown -R nextjs:nodejs /app
USER nextjs

# Comando para ejecutar la aplicación
CMD ["npm", "start"]