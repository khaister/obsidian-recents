.PHONY: release release-dry-run release-alpha release-beta

# PRE=alpha or PRE=beta publishes a pre-release, e.g. make release PRE=beta.
PRE_FLAG = $(if $(PRE),--$(PRE))

release:
	./scripts/release.sh $(PRE_FLAG) $(ARGS)

release-dry-run:
	./scripts/release.sh --dry-run $(PRE_FLAG) $(ARGS)

release-alpha:
	./scripts/release.sh --alpha $(ARGS)

release-beta:
	./scripts/release.sh --beta $(ARGS)
