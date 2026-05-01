from typing import TypedDict


class PostDocument(TypedDict, total=False):
    _id: str
    id: str
    author_id: str
    caption: str
    image_urls: list[str]
    hashtags: list[str]
    created_at: str


POSTS_COLLECTION = "posts"
