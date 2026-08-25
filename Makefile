.PHONY: build test install dev dist

build:
	go build -o bin/peek ./cmd/peek

test:
	go test ./...

install: build
	./bin/peek install --dev

dev: install
	./bin/peek doctor

dist:
	rm -rf dist
	mkdir -p dist
	@for pair in darwin/arm64 darwin/amd64 linux/arm64 linux/amd64; do \
		os=$${pair%/*}; arch=$${pair#*/}; \
		echo "building $$os/$$arch"; \
		CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch go build -ldflags '-s -w' -o dist/peek ./cmd/peek; \
		tar -C dist -czf dist/peek_$${os}_$${arch}.tar.gz peek; \
	done
	rm -f dist/peek
	cd dist && shasum -a 256 peek_*.tar.gz > checksums.txt
	cat dist/checksums.txt
