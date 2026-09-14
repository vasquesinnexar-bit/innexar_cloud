# novo-site – Next.js 16
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --fund=false

COPY . .
ARG NEXT_PUBLIC_CRM_BASE_URL=https://crm.innexar.com.br
ARG NEXT_PUBLIC_CRM_API_URL=https://api-crm.innexar.com.br
ARG NEXT_PUBLIC_CRM_WEBSITE_TOKEN=
ENV NEXT_PUBLIC_CRM_BASE_URL=$NEXT_PUBLIC_CRM_BASE_URL
ENV NEXT_PUBLIC_CRM_API_URL=$NEXT_PUBLIC_CRM_API_URL
ENV NEXT_PUBLIC_CRM_WEBSITE_TOKEN=$NEXT_PUBLIC_CRM_WEBSITE_TOKEN
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
