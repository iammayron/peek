.PHONY: icons build test install dev dist

icons:
	go run ./tools/genicons extension/icons

build: icons
	go build -o bin/inspectai ./cmd/inspectai

test:
	go test ./...

install: build
	./bin/inspectai install --dev

dev: install
	./bin/inspectai doctor

dist:
	rm -rf dist
	mkdir -p dist
	@for pair in darwin/arm64 darwin/amd64 linux/arm64 linux/amd64; do \
		os=$${pair%/*}; arch=$${pair#*/}; \
		echo "building $$os/$$arch"; \
		CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch go build -ldflags '-s -w' -o dist/inspectai ./cmd/inspectai; \
		tar -C dist -czf dist/inspectai_$${os}_$${arch}.tar.gz inspectai; \
	done
	rm -f dist/inspectai
	cd dist && shasum -a 256 inspectai_*.tar.gz > checksums.txt
	cat dist/checksums.txt
