# ---------------------------------------------------------------------------
# Imagem do frontend: build do Vite + nginx.
#
# O Vite resolve `import.meta.env.VITE_*` em tempo de *build*: a URL da API é
# assada no bundle, não lida em runtime. Por isso ela entra como ARG — quem
# publica em outro host passa `--build-arg VITE_API_BASE_URL=...`.
#
# O estágio final é um nginx com o bundle estático (~55 MB), sem Node algum.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /web

# O manifesto entra antes do código para que `npm ci` reaproveite a camada de
# cache enquanto só os fontes mudam.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build


FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
