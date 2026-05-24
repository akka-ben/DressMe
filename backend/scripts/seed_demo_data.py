from __future__ import annotations

import argparse
import asyncio
import os
import random
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, uuid5


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
if (PROJECT_ROOT / ".env").exists():
    os.chdir(PROJECT_ROOT)

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import database, init_db, mongo_client


SEED_TAG = "demo-mvp-2026-05"
DEFAULT_PASSWORD = "DressMeDemo123!"


IMAGE_URLS = [
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1506629905607-d9f297d9e5e3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1507680434567-5739c80be1ac?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1506152983158-b4a74a01c721?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1517298257259-f72ccd2db392?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=900&q=80",
]


VIDEO_URLS = [
    "/uploads/video/79f48a3baa8a4b428f6bebc9dc935dea.mp4",
    "/uploads/video/8dfcf9cb12cd4e0399960705a87542d6.mp4",
    "/uploads/video/b33c4de1d1b64c97b711a9b2f8fa6002.mp4",
]


USERS = [
    {
        "key": "presenter",
        "email": "test1@gmail.com",
        "username": "test1",
        "first_name": "Mohammed",
        "last_name": "Ben Akka Ouayad",
        "bio": "Createur DressMe. Streetwear, IA stylist et looks MVP.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=mohammed",
        "is_private": False,
    },
    {
        "key": "viewer",
        "email": "viewer@gmail.com",
        "username": "viewer",
        "first_name": "Viewer",
        "last_name": "Demo",
        "bio": "Compte viewer pour tester les lives, reels et notifications.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=viewer",
        "is_private": False,
    },
    {
        "key": "creator",
        "email": "creator@gmail.com",
        "username": "creator",
        "first_name": "Youssef",
        "last_name": "Bennani",
        "bio": "Sneakers, layering et streetwear Casablanca.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=youssef",
        "is_private": False,
    },
    {
        "key": "private",
        "email": "private@gmail.com",
        "username": "private.looks",
        "first_name": "Reda",
        "last_name": "Amor",
        "bio": "Compte prive pour tester demandes d'abonnement.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=reda",
        "is_private": True,
    },
    {
        "key": "amina",
        "email": "amina.demo@dressme.app",
        "username": "amina_chic",
        "first_name": "Amina",
        "last_name": "Benjelloun",
        "bio": "Hijab fashion, office looks et elegance simple.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=amina",
        "is_private": False,
    },
    {
        "key": "karim",
        "email": "karim.demo@dressme.app",
        "username": "karim_looks",
        "first_name": "Karim",
        "last_name": "Alaoui",
        "bio": "Vintage collector et thrift fits a Rabat.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=karim",
        "is_private": False,
    },
    {
        "key": "sophia",
        "email": "sophia.demo@dressme.app",
        "username": "sophia_laurent",
        "first_name": "Sophia",
        "last_name": "Laurent",
        "bio": "Paris minimal, black dresses et capsule wardrobe.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=sophia",
        "is_private": False,
    },
    {
        "key": "nadia",
        "email": "nadia.demo@dressme.app",
        "username": "nadia_outfit",
        "first_name": "Nadia",
        "last_name": "Berrada",
        "bio": "Marrakech colors, caftan moderne et accessoires.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=nadia",
        "is_private": False,
    },
    {
        "key": "leila",
        "email": "leila.demo@dressme.app",
        "username": "leila_mansouri",
        "first_name": "Leila",
        "last_name": "Mansouri",
        "bio": "Workwear, votes Help Me Choose et looks de reunion.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=leila",
        "is_private": False,
    },
    {
        "key": "omar",
        "email": "omar.demo@dressme.app",
        "username": "omar_fitted",
        "first_name": "Omar",
        "last_name": "Idrissi",
        "bio": "Smart casual, gym fits et lifestyle Tanger.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=omar",
        "is_private": False,
    },
    {
        "key": "sara",
        "email": "sara.demo@dressme.app",
        "username": "sara_modest",
        "first_name": "Sara",
        "last_name": "Chraibi",
        "bio": "Modest wear, camel coats et palettes neutres.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=sara",
        "is_private": False,
    },
    {
        "key": "ilyas",
        "email": "ilyas.demo@dressme.app",
        "username": "ilyas_casa",
        "first_name": "Ilyas",
        "last_name": "Sakout",
        "bio": "Casablanca street shots et edits reels.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=ilyas",
        "is_private": False,
    },
    {
        "key": "hind",
        "email": "hind.demo@dressme.app",
        "username": "hind_palette",
        "first_name": "Hind",
        "last_name": "El Amrani",
        "bio": "Color analysis et tendances soft glam.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=hind",
        "is_private": False,
    },
    {
        "key": "mehdi",
        "email": "mehdi.demo@dressme.app",
        "username": "mehdi_tailor",
        "first_name": "Mehdi",
        "last_name": "Tazi",
        "bio": "Tailoring, blazers et tenues business.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=mehdi",
        "is_private": False,
    },
    {
        "key": "meryem",
        "email": "meryem.demo@dressme.app",
        "username": "meryem_style",
        "first_name": "Meryem",
        "last_name": "Ait Lahcen",
        "bio": "Agadir summer looks et robes fluides.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=meryem",
        "is_private": False,
    },
    {
        "key": "samir",
        "email": "samir.demo@dressme.app",
        "username": "samir_reels",
        "first_name": "Samir",
        "last_name": "El Fassi",
        "bio": "Reels editor, fits checks et videos rapides.",
        "avatar_url": "https://api.dicebear.com/8.x/personas/png?seed=samir",
        "is_private": False,
    },
]


POST_TOPICS = [
    ("Blazer burgundy avec denim brut pour un rendu smart casual.", ["#smartcasual", "#burgundy", "#denim"], ["blazer", "denim", "loafers"], "Casablanca"),
    ("Caftan revisite pour une soiree familiale a Fes.", ["#caftan", "#mariage", "#traditionnel"], ["caftan", "babouches", "gold"], "Fes"),
    ("Oversized hoodie, cargo pants et sneakers blanches.", ["#streetwear", "#casual", "#sneakers"], ["hoodie", "cargo", "sneakers"], "Rabat"),
    ("Robe noire minimaliste pour diner en terrasse.", ["#soiree", "#minimal", "#elegant"], ["dress", "heels", "clutch"], "Paris"),
    ("Camel coat et hijab cream pour le bureau.", ["#modest", "#workwear", "#camel"], ["coat", "hijab", "sneakers"], "Casablanca"),
    ("Linen shirt et pantalon beige pour un dimanche soleil.", ["#summer", "#linen", "#minimal"], ["shirt", "linen pants", "espadrilles"], "Agadir"),
    ("Bomber olive avec hoodie gris, layering simple.", ["#layering", "#streetwear", "#fall"], ["bomber", "hoodie", "jeans"], "Tanger"),
    ("Drop sneakers: promo boutique locale ce weekend.", ["#drop", "#promo", "#sneakers"], ["sneakers", "joggers", "tee"], "Casablanca"),
    ("Robe fluide turquoise pour brunch a Marrakech.", ["#brunch", "#color", "#dress"], ["dress", "sandals", "bag"], "Marrakech"),
    ("Tailored suit marine, chemise blanche et montre fine.", ["#business", "#tailoring", "#navy"], ["suit", "shirt", "watch"], "Rabat"),
    ("Total look noir avec lunettes et veste structuree.", ["#allblack", "#streetwear", "#nightout"], ["jacket", "pants", "sunglasses"], "Casablanca"),
    ("T-shirt blanc, jeans straight et boots marron.", ["#casual", "#denim", "#boots"], ["t-shirt", "jeans", "boots"], "Tanger"),
    ("Look pastel pour une journee shopping.", ["#pastel", "#shopping", "#spring"], ["cardigan", "skirt", "bag"], "Marrakech"),
    ("Abaya moderne avec sac mini et sandales.", ["#abaya", "#modest", "#elegant"], ["abaya", "mini bag", "sandals"], "Fes"),
    ("Outfit sport chic: zip hoodie et pantalon cargo.", ["#sportchic", "#cargo", "#dailyfit"], ["zip hoodie", "cargo", "trainers"], "Agadir"),
    ("Trench beige et pantalon noir: rainy day uniform.", ["#trench", "#minimal", "#workwear"], ["trench", "pants", "loafers"], "Paris"),
    ("Chemise rayee ouverte sur debardeur blanc.", ["#summer", "#stripes", "#casual"], ["striped shirt", "tank", "shorts"], "Casablanca"),
    ("Help Me Choose: blazer noir ou veste en jean ?", ["#helpmechoose", "#poll", "#blazer"], ["blazer", "denim jacket", "boots"], "Rabat"),
]


REEL_TOPICS = [
    ("GRWM rapide: tenue campus en 20 secondes.", ["#grwm", "#reel", "#campus"], ["hoodie", "jeans", "sneakers"], "Casablanca"),
    ("Transition reel: caftan moderne avant/apres.", ["#reel", "#transition", "#caftan"], ["caftan", "jewelry"], "Fes"),
    ("Streetwear check devant Morocco Mall.", ["#streetwear", "#reel", "#casablanca"], ["bomber", "cargo", "sneakers"], "Casablanca"),
    ("Mini haul soldes: 3 pieces a moins de 300 dh.", ["#soldes", "#haul", "#shopping"], ["shirt", "pants", "bag"], "Rabat"),
    ("Routine accessoires: lunettes, bague, montre.", ["#accessories", "#reel", "#details"], ["watch", "rings", "sunglasses"], "Paris"),
    ("Fit check live room avant le lancement.", ["#live", "#fitcheck", "#dressme"], ["blazer", "tee", "pants"], "Tanger"),
    ("Comment styler une chemise blanche.", ["#tutorial", "#shirt", "#minimal"], ["shirt", "jeans", "belt"], "Agadir"),
    ("Reel boutique: drop sneakers ce soir.", ["#drop", "#sneakers", "#promo"], ["sneakers", "jacket"], "Casablanca"),
]


COMMENTS = [
    "Le rendu est propre, surtout avec ces couleurs.",
    "Je valide le layering, ca fait tres Instagram.",
    "La paire de sneakers change tout.",
    "Tu peux ajouter une ceinture fine et ce sera parfait.",
    "La coupe est vraiment bien equilibree.",
    "Je veux voir ce look en reel aussi.",
    "La palette marche trop bien pour la saison.",
    "Le blazer est parfait pour ce style.",
    "Tres bon choix pour une presentation MVP.",
    "@test1 tu devrais tester cette combinaison dans DressMe.",
    "Simple, efficace, portable.",
    "Le lieu donne vraiment de la valeur au look.",
]


def stable_id(*parts: str) -> str:
    return str(uuid5(NAMESPACE_URL, ":".join(parts)))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def past(minutes: int) -> datetime:
    return utc_now() - timedelta(minutes=minutes)


def normalize_tag(tag: str) -> str:
    value = tag.strip().lower()
    return value if value.startswith("#") else f"#{value}"


def relation_id(left: str, right: str) -> str:
    return f"{left}:{right}"


async def delete_seeded_documents() -> dict[str, int]:
    collections = [
        "posts",
        "comments",
        "post_likes",
        "post_shares",
        "saved_posts",
        "follows",
        "follow_requests",
        "stories",
        "live_sessions",
        "notification_reads",
    ]
    deleted: dict[str, int] = {}
    for collection_name in collections:
        result = await database[collection_name].delete_many({"seedTag": SEED_TAG})
        deleted[collection_name] = result.deleted_count

    user_result = await database.users.delete_many({"seedTag": SEED_TAG})
    deleted["users"] = user_result.deleted_count
    return deleted


async def upsert_user(blueprint: dict[str, Any], password: str) -> tuple[str, bool]:
    now = utc_now()
    email = str(blueprint["email"]).lower()
    existing = await database.users.find_one({"email": email})
    user_id = str(existing.get("_id")) if existing else stable_id("user", blueprint["key"])
    is_seeded_existing = bool(existing and existing.get("seedTag") == SEED_TAG)

    user_doc = {
        "_id": user_id,
        "id": user_id,
        "email": email,
        "username": blueprint["username"],
        "first_name": blueprint["first_name"],
        "last_name": blueprint["last_name"],
        "bio": blueprint["bio"],
        "avatar_url": blueprint["avatar_url"],
        "phone_number": None,
        "password_hash": hash_password(password),
        "is_verified": True,
        "is_private": bool(blueprint.get("is_private")),
        "privacy": "private" if blueprint.get("is_private") else "public",
        "followers_count": 0,
        "following_count": 0,
        "last_seen": past(10 + len(blueprint["key"])),
        "created_at": now - timedelta(days=40 + len(blueprint["key"])),
        "updated_at": now,
        "seedTag": SEED_TAG,
    }

    if not existing or is_seeded_existing:
        await database.users.replace_one({"_id": user_id}, user_doc, upsert=True)
        return user_id, False

    updates: dict[str, Any] = {
        "is_verified": True,
        "last_seen": now,
        "updated_at": now,
        "demoSeedLinked": SEED_TAG,
    }
    for field_name in ("username", "first_name", "last_name", "bio", "avatar_url"):
        if not existing.get(field_name):
            updates[field_name] = user_doc[field_name]
    if "is_private" not in existing:
        updates["is_private"] = bool(blueprint.get("is_private"))
    await database.users.update_one({"_id": user_id}, {"$set": updates})
    return user_id, True


async def seed_users(password: str) -> tuple[dict[str, str], list[str]]:
    ids: dict[str, str] = {}
    reused: list[str] = []
    for blueprint in USERS:
        user_id, was_reused = await upsert_user(blueprint, password)
        ids[blueprint["key"]] = user_id
        if was_reused:
            reused.append(blueprint["email"])
    return ids, reused


async def upsert_relation(
    collection_name: str,
    key_filter: dict[str, str],
    document: dict[str, Any],
) -> None:
    existing = await database[collection_name].find_one(key_filter)
    if existing:
        await database[collection_name].update_one(
            {"_id": existing["_id"]},
            {"$set": {key: value for key, value in document.items() if key != "_id"}},
        )
        return
    await database[collection_name].insert_one(document)


async def seed_follows(user_ids: dict[str, str]) -> int:
    pairs_by_key = [
        ("presenter", "creator"),
        ("presenter", "amina"),
        ("presenter", "karim"),
        ("presenter", "sophia"),
        ("presenter", "nadia"),
        ("presenter", "leila"),
        ("presenter", "sara"),
        ("presenter", "ilyas"),
        ("viewer", "presenter"),
        ("viewer", "creator"),
        ("viewer", "amina"),
        ("viewer", "samir"),
        ("creator", "presenter"),
        ("amina", "presenter"),
        ("karim", "presenter"),
        ("sophia", "presenter"),
        ("nadia", "presenter"),
        ("leila", "presenter"),
        ("omar", "presenter"),
        ("sara", "presenter"),
        ("ilyas", "presenter"),
        ("hind", "presenter"),
        ("mehdi", "presenter"),
        ("meryem", "presenter"),
        ("samir", "presenter"),
        ("creator", "amina"),
        ("creator", "karim"),
        ("amina", "sara"),
        ("karim", "creator"),
        ("sophia", "nadia"),
        ("nadia", "meryem"),
        ("leila", "mehdi"),
        ("omar", "creator"),
        ("sara", "amina"),
        ("ilyas", "samir"),
        ("hind", "sophia"),
        ("mehdi", "leila"),
        ("meryem", "nadia"),
        ("samir", "ilyas"),
    ]
    now = utc_now()
    count = 0
    for index, (follower_key, following_key) in enumerate(pairs_by_key):
        follower_id = user_ids[follower_key]
        following_id = user_ids[following_key]
        doc_id = relation_id(follower_id, following_id)
        await upsert_relation(
            "follows",
            {"follower_id": follower_id, "following_id": following_id},
            {
                "_id": doc_id,
                "id": doc_id,
                "follower_id": follower_id,
                "following_id": following_id,
                "created_at": now - timedelta(minutes=15 + index * 17),
                "updated_at": now - timedelta(minutes=15 + index * 17),
                "seedTag": SEED_TAG,
            },
        )
        count += 1

    request_pairs = [
        ("presenter", "private"),
        ("viewer", "private"),
        ("private", "presenter"),
        ("private", "viewer"),
        ("hind", "private"),
    ]
    for index, (follower_key, following_key) in enumerate(request_pairs):
        follower_id = user_ids[follower_key]
        following_id = user_ids[following_key]
        doc_id = relation_id(follower_id, following_id)
        await upsert_relation(
            "follow_requests",
            {"follower_id": follower_id, "following_id": following_id},
            {
                "_id": doc_id,
                "id": doc_id,
                "follower_id": follower_id,
                "following_id": following_id,
                "status": "pending",
                "created_at": now - timedelta(minutes=8 + index * 11),
                "updated_at": now - timedelta(minutes=8 + index * 11),
                "seedTag": SEED_TAG,
            },
        )

    await refresh_user_counts()
    return count


async def refresh_user_counts() -> None:
    users = await database.users.find({}).to_list(length=500)
    for user in users:
        user_id = str(user.get("_id"))
        follower_count = await database.follows.count_documents({"following_id": user_id})
        following_count = await database.follows.count_documents({"follower_id": user_id})
        post_count = await database.posts.count_documents({"author_id": user_id})
        await database.users.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "followers_count": follower_count,
                    "following_count": following_count,
                    "posts_count": post_count,
                }
            },
        )


def build_post_blueprints() -> list[dict[str, Any]]:
    author_keys = [
        "presenter",
        "creator",
        "amina",
        "karim",
        "sophia",
        "nadia",
        "leila",
        "omar",
        "sara",
        "ilyas",
        "hind",
        "mehdi",
        "meryem",
        "samir",
        "viewer",
    ]
    posts: list[dict[str, Any]] = []
    for index in range(45):
        topic = POST_TOPICS[index % len(POST_TOPICS)]
        caption, hashtags, garment_tags, city = topic
        posts.append(
            {
                "index": index,
                "author_key": author_keys[index % len(author_keys)],
                "caption": f"{caption} Look #{index + 1}",
                "hashtags": hashtags,
                "garment_tags": garment_tags,
                "city": city,
                "media_type": "image",
                "media_url": IMAGE_URLS[index % len(IMAGE_URLS)],
            }
        )

    for index in range(20):
        topic = REEL_TOPICS[index % len(REEL_TOPICS)]
        caption, hashtags, garment_tags, city = topic
        posts.append(
            {
                "index": 100 + index,
                "author_key": author_keys[(index * 2 + 1) % len(author_keys)],
                "caption": f"{caption} Reel demo #{index + 1}",
                "hashtags": hashtags,
                "garment_tags": garment_tags,
                "city": city,
                "media_type": "video",
                "media_url": VIDEO_URLS[index % len(VIDEO_URLS)],
            }
        )
    return posts


async def seed_posts(user_ids: dict[str, str]) -> list[dict[str, Any]]:
    rng = random.Random(20260521)
    user_id_values = list(user_ids.values())
    post_docs: list[dict[str, Any]] = []
    now = utc_now()
    for rank, blueprint in enumerate(build_post_blueprints()):
        author_id = user_ids[blueprint["author_key"]]
        post_id = stable_id("post", str(blueprint["index"]), blueprint["caption"])
        available_likers = [user_id for user_id in user_id_values if user_id != author_id]
        rng.shuffle(available_likers)
        like_count = 3 + (rank % 8)
        like_user_ids = available_likers[:like_count]
        created_at = now - timedelta(minutes=20 + rank * 31)
        post_doc = {
            "_id": post_id,
            "id": post_id,
            "author_id": author_id,
            "caption": blueprint["caption"],
            "media_type": blueprint["media_type"],
            "hashtags": [normalize_tag(tag) for tag in blueprint["hashtags"]],
            "garment_tags": blueprint["garment_tags"],
            "image_urls": [blueprint["media_url"]],
            "like_user_ids": like_user_ids,
            "comment_count": 0,
            "share_count": 0,
            "city": blueprint["city"],
            "place": blueprint["city"],
            "location": {"name": blueprint["city"], "city": blueprint["city"], "country": "Morocco" if blueprint["city"] != "Paris" else "France"},
            "created_at": created_at,
            "updated_at": created_at + timedelta(minutes=7),
            "seedTag": SEED_TAG,
        }
        if rank in {2, 17, 38}:
            option_a = IMAGE_URLS[(rank + 1) % len(IMAGE_URLS)]
            option_b = IMAGE_URLS[(rank + 2) % len(IMAGE_URLS)]
            post_doc["poll"] = {
                "id": stable_id("poll", post_id),
                "options": [
                    {"id": stable_id("poll-option", post_id, "a"), "label": "Option A", "image_url": option_a, "votes": 12 + rank},
                    {"id": stable_id("poll-option", post_id, "b"), "label": "Option B", "image_url": option_b, "votes": 9 + rank},
                ],
            }
        await database.posts.replace_one({"_id": post_id}, post_doc, upsert=True)
        post_docs.append(post_doc)

    await seed_likes(post_docs)
    await seed_comments(post_docs, user_id_values)
    await seed_saves_and_shares(post_docs, user_ids)
    await refresh_post_counts(post_docs)
    await refresh_user_counts()
    return post_docs


async def seed_likes(post_docs: list[dict[str, Any]]) -> int:
    count = 0
    for post in post_docs:
        post_id = str(post["_id"])
        created_at = post["created_at"] + timedelta(minutes=3)
        for index, user_id in enumerate(post.get("like_user_ids", [])):
            like_id = relation_id(str(user_id), post_id)
            await database.post_likes.replace_one(
                {"_id": like_id},
                {
                    "_id": like_id,
                    "id": like_id,
                    "user_id": str(user_id),
                    "post_id": post_id,
                    "created_at": created_at + timedelta(minutes=index),
                    "updated_at": created_at + timedelta(minutes=index),
                    "seedTag": SEED_TAG,
                },
                upsert=True,
            )
            count += 1
    return count


async def seed_comments(post_docs: list[dict[str, Any]], user_ids: list[str]) -> int:
    rng = random.Random(20260522)
    count = 0
    for post_index, post in enumerate(post_docs):
        author_id = str(post["author_id"])
        candidates = [user_id for user_id in user_ids if user_id != author_id]
        rng.shuffle(candidates)
        comment_total = post_index % 5
        if post_index in {0, 1, 4, 9, 16, 27}:
            comment_total += 2
        for offset in range(comment_total):
            commenter_id = candidates[offset % len(candidates)]
            content = COMMENTS[(post_index + offset) % len(COMMENTS)]
            comment_id = stable_id("comment", str(post["_id"]), str(offset))
            created_at = post["created_at"] + timedelta(minutes=10 + offset * 6)
            await database.comments.replace_one(
                {"_id": comment_id},
                {
                    "_id": comment_id,
                    "id": comment_id,
                    "post_id": str(post["_id"]),
                    "author_id": commenter_id,
                    "content": content,
                    "created_at": created_at,
                    "updated_at": created_at,
                    "seedTag": SEED_TAG,
                },
                upsert=True,
            )
            count += 1
    return count


async def seed_saves_and_shares(post_docs: list[dict[str, Any]], user_ids: dict[str, str]) -> tuple[int, int]:
    save_count = 0
    share_count = 0
    active_savers = [
        user_ids["presenter"],
        user_ids["viewer"],
        user_ids["creator"],
        user_ids["amina"],
        user_ids["leila"],
        user_ids["sara"],
    ]
    for index, post in enumerate(post_docs):
        post_id = str(post["_id"])
        media_type = str(post.get("media_type") or "image")
        if index % 3 == 0:
            saver_id = active_savers[index % len(active_savers)]
            if saver_id != str(post["author_id"]):
                save_id = relation_id(saver_id, post_id)
                await upsert_relation(
                    "saved_posts",
                    {"user_id": saver_id, "post_id": post_id},
                    {
                        "_id": save_id,
                        "id": save_id,
                        "user_id": saver_id,
                        "post_id": post_id,
                        "media_type": media_type,
                        "created_at": post["created_at"] + timedelta(minutes=17),
                        "seedTag": SEED_TAG,
                    },
                )
                save_count += 1
        if index % 5 == 0:
            sharer_id = active_savers[(index + 2) % len(active_savers)]
            if sharer_id != str(post["author_id"]):
                share_id = stable_id("share", sharer_id, post_id)
                await database.post_shares.replace_one(
                    {"_id": share_id},
                    {
                        "_id": share_id,
                        "id": share_id,
                        "post_id": post_id,
                        "user_id": sharer_id,
                        "created_at": post["created_at"] + timedelta(minutes=23),
                        "seedTag": SEED_TAG,
                    },
                    upsert=True,
                )
                share_count += 1
    return save_count, share_count


async def refresh_post_counts(post_docs: list[dict[str, Any]]) -> None:
    for post in post_docs:
        post_id = str(post["_id"])
        comment_count = await database.comments.count_documents({"post_id": post_id})
        share_count = await database.post_shares.count_documents({"post_id": post_id})
        await database.posts.update_one(
            {"_id": post_id},
            {"$set": {"comment_count": comment_count, "share_count": share_count}},
        )


async def seed_stories(user_ids: dict[str, str]) -> int:
    story_authors = ["presenter", "creator", "amina", "karim", "sophia", "nadia", "leila", "sara", "ilyas", "hind", "meryem", "samir"]
    viewers = [user_ids[key] for key in ["viewer", "creator", "amina", "karim", "sophia", "nadia", "leila", "sara"]]
    now = utc_now()
    for index, author_key in enumerate(story_authors):
        author_id = user_ids[author_key]
        media_type = "video" if index % 4 == 0 else "image"
        media_url = VIDEO_URLS[index % len(VIDEO_URLS)] if media_type == "video" else IMAGE_URLS[(index + 4) % len(IMAGE_URLS)]
        story_id = stable_id("story", author_key, str(index))
        viewed_user_ids = [viewer for viewer in viewers[: (index % 5)] if viewer != author_id]
        await database.stories.replace_one(
            {"_id": story_id},
            {
                "_id": story_id,
                "id": story_id,
                "author_id": author_id,
                "media_url": media_url,
                "media_type": media_type,
                "caption": f"Story demo {index + 1}: {author_key} style check",
                "viewed_user_ids": viewed_user_ids,
                "created_at": now - timedelta(minutes=8 + index * 13),
                "updated_at": now - timedelta(minutes=8 + index * 13),
                "expires_at": now + timedelta(hours=24 - index),
                "seedTag": SEED_TAG,
            },
            upsert=True,
        )
    return len(story_authors)


async def seed_live_sessions(user_ids: dict[str, str]) -> int:
    sessions = [
        ("creator", "Live sneakers: drop et fit check", "live", 4),
        ("amina", "Modest office looks en direct", "live", 7),
        ("samir", "Reels setup et test WebRTC", "live", 2),
        ("nadia", "Marrakech colors live styling", "live", 9),
        ("mehdi", "Blazer clinic: tailles et coupes", "live", 12),
        ("presenter", "Replay MVP DressMe live", "ended", 180),
        ("viewer", "Test viewer ended session", "ended", 240),
    ]
    now = utc_now()
    viewer_pool = [user_id for key, user_id in user_ids.items() if key not in {"private"}]
    for index, (host_key, title, status_value, minutes_ago) in enumerate(sessions):
        host_id = user_ids[host_key]
        live_id = stable_id("live", host_key, title)
        viewers = [viewer for viewer in viewer_pool[: 3 + index] if viewer != host_id]
        session = {
            "_id": live_id,
            "id": live_id,
            "host_id": host_id,
            "title": title,
            "status": status_value,
            "viewer_ids": viewers,
            "started_at": now - timedelta(minutes=minutes_ago),
            "updated_at": now - timedelta(minutes=max(1, minutes_ago - 2)),
            "seedTag": SEED_TAG,
        }
        if status_value == "ended":
            session["ended_at"] = now - timedelta(minutes=max(1, minutes_ago - 25))
        await database.live_sessions.replace_one({"_id": live_id}, session, upsert=True)
    return len(sessions)


async def seed_notification_reads(user_ids: dict[str, str]) -> int:
    presenter_id = user_ids["presenter"]
    read_count = 0
    for suffix in ["old-demo-read-1", "old-demo-read-2"]:
        read_id = relation_id(presenter_id, suffix)
        await database.notification_reads.replace_one(
            {"_id": read_id},
            {
                "_id": read_id,
                "user_id": presenter_id,
                "notification_id": suffix,
                "read_at": utc_now() - timedelta(days=3),
                "seedTag": SEED_TAG,
            },
            upsert=True,
        )
        read_count += 1
    return read_count


async def summarize() -> dict[str, int]:
    collections = [
        "users",
        "posts",
        "comments",
        "post_likes",
        "post_shares",
        "saved_posts",
        "follows",
        "follow_requests",
        "stories",
        "live_sessions",
    ]
    return {collection: await database[collection].count_documents({"seedTag": SEED_TAG}) for collection in collections}


async def run_seed(args: argparse.Namespace) -> None:
    if args.dry_run:
        print(f"DRY RUN: would seed Mongo database {settings.mongodb_db_name!r} at {settings.mongodb_url!r}")
        print(f"Seed tag: {SEED_TAG}")
        print(f"Demo password for new/seeded accounts: {args.password}")
        return

    await init_db()
    if args.reset:
        deleted = await delete_seeded_documents()
        print("Deleted seeded documents:")
        for collection, count in deleted.items():
            print(f"  {collection}: {count}")

    user_ids, reused_accounts = await seed_users(args.password)
    follow_count = await seed_follows(user_ids)
    posts = await seed_posts(user_ids)
    story_count = await seed_stories(user_ids)
    live_count = await seed_live_sessions(user_ids)
    read_count = await seed_notification_reads(user_ids)
    await refresh_user_counts()

    summary = await summarize()
    print("\nDemo data seeded successfully.")
    print(f"Mongo database: {settings.mongodb_db_name}")
    print(f"Seed tag: {SEED_TAG}")
    print(f"Password for new/seeded accounts: {args.password}")
    if reused_accounts:
        print("Existing accounts reused without password overwrite:")
        for email in reused_accounts:
            print(f"  {email}")
    print("\nLogin accounts:")
    for account in USERS[:4]:
        print(f"  {account['email']} / {args.password if account['email'] not in reused_accounts else '<existing password>'}")
    print("\nInserted/updated counts:")
    for collection, count in summary.items():
        print(f"  {collection}: {count}")
    print(f"  follows_upserted_in_run: {follow_count}")
    print(f"  posts_upserted_in_run: {len(posts)}")
    print(f"  stories_upserted_in_run: {story_count}")
    print(f"  live_sessions_upserted_in_run: {live_count}")
    print(f"  notification_reads_upserted_in_run: {read_count}")

    media_counter = Counter(str(post.get("media_type")) for post in posts)
    print("\nMedia mix:")
    print(f"  images: {media_counter.get('image', 0)}")
    print(f"  videos/reels: {media_counter.get('video', 0)}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed DressMe Mongo with MVP demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete documents tagged with this seed before inserting fresh demo data.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen without connecting to Mongo.",
    )
    parser.add_argument(
        "--password",
        default=DEFAULT_PASSWORD,
        help="Password assigned to newly created or previously seeded demo users.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        asyncio.run(run_seed(args))
    finally:
        mongo_client.close()


if __name__ == "__main__":
    main()
