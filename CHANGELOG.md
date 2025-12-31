## [1.0.1](https://github.com/Jensen95/homeassistant-hofos/compare/v1.0.0...v1.0.1) (2025-12-31)


### Bug Fixes

* separate release and Docker build workflows by trigger ([d1425c3](https://github.com/Jensen95/homeassistant-hofos/commit/d1425c3cf05f7378c777f2e6fd9f563d9e4a4875))

# 1.0.0 (2025-12-31)


### Bug Fixes

* add repository field and remove npm publish from releases ([afd0011](https://github.com/Jensen95/homeassistant-hofos/commit/afd001149b75f4be10bf99fd698559dc108c440c))
* Correct ignores for docker ([96133e2](https://github.com/Jensen95/homeassistant-hofos/commit/96133e2c06009898bcf5c0586dae3384a77ca306))
* Make release tags on docker image lowercase ([b8d7b69](https://github.com/Jensen95/homeassistant-hofos/commit/b8d7b697872a1346ce359b2e78408162803383ff))


### Features

* Adds CI flows and a better linting setup ([#2](https://github.com/Jensen95/homeassistant-hofos/issues/2)) ([0cf053c](https://github.com/Jensen95/homeassistant-hofos/commit/0cf053ce00fdea099be3b6e10f862b0a017a14da))
* configure semantic-release with changelog generation and version syncing ([d1ab4bd](https://github.com/Jensen95/homeassistant-hofos/commit/d1ab4bda4e774d5c0711c42a9057f6ca03208ae6))
* HomeAssistant config template ([3b28a64](https://github.com/Jensen95/homeassistant-hofos/commit/3b28a6441a218da572867c7b719b115d32462dd7))
* initial playwright scraper ([d221914](https://github.com/Jensen95/homeassistant-hofos/commit/d22191435d907b6d93993b6cbc222d0e053acddd))
* Initial setup ([2d9f1c4](https://github.com/Jensen95/homeassistant-hofos/commit/2d9f1c4393a3974e00d9d6845f5b56cfab2cd816))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release of HOFOR Scraper addon
- Automated water consumption data scraping from HOFOR
- InfluxDB integration for time-series data storage
- Historical data backfilling (up to 2 years)
- Configurable scraping intervals
- Water price tracking (optional)
- Graceful shutdown handling
- Retry logic with exponential backoff
- Multi-stage Docker build for optimized image size
- CI/CD pipeline with GitHub Actions
- Commitizen for conventional commits
- Dependabot for automated dependency updates

## [0.1.0] - 2025-12-30

### Added

- Initial beta release
- Core scraping functionality
- InfluxDB storage backend
- Home Assistant addon configuration
- Documentation and setup instructions

[Unreleased]: https://github.com/Jensen95/homeassistant-hofos/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Jensen95/homeassistant-hofos/releases/tag/v0.1.0
