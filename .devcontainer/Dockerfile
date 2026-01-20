FROM harbor.dev.ppfd.kr/docker/oven/bun:1.3.3

WORKDIR /app

COPY . .

RUN apt-get update -y
RUN apt-get install -y bash unzip ca-certificates openssl default-mysql-client git curl python3 make g++
RUN apt-get clean

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/root/.local/bin:$PATH"
ENV CLAUDE_CODE_USE_BEDROCK=1
