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
