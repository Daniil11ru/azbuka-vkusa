"""Кэш рекомендаций в Redis (как в архитектуре ВКР).

Демо продолжает работать и без Redis: все операции обёрнуты
в try/except и деградируют до прямого чтения из базы.
"""

import json
import logging

import redis

from app.config import settings

logger = logging.getLogger(__name__)

try:
    _client = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1,
                                   socket_timeout=1, decode_responses=True)
except Exception:  # noqa: BLE001
    _client = None


def cache_get(key: str):
    if _client is None:
        return None
    try:
        raw = _client.get(key)
        return json.loads(raw) if raw else None
    except Exception:  # noqa: BLE001
        return None


def cache_set(key: str, value, ttl_seconds: int = 300) -> None:
    if _client is None:
        return
    try:
        _client.setex(key, ttl_seconds, json.dumps(value, ensure_ascii=False, default=str))
    except Exception:  # noqa: BLE001
        logger.debug("Redis недоступен, кэш пропущен")


def cache_delete(*keys: str) -> None:
    if _client is None or not keys:
        return
    try:
        _client.delete(*keys)
    except Exception:  # noqa: BLE001
        pass
