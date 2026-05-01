from uuid import uuid4

from fastapi import APIRouter

from app.schemas.contracts import AIRecommendationDTO, AIRecommendationItemDTO, HelpMeChooseInput


router = APIRouter()


@router.post("/help-me-choose", response_model=list[AIRecommendationDTO])
async def help_me_choose(payload: HelpMeChooseInput) -> list[AIRecommendationDTO]:
    preview = payload.image_url
    return [
        AIRecommendationDTO(
            id=str(uuid4()),
            title="Smart Casual Contrast",
            rationale="Balances the main piece with clean neutral layers for a polished evening look.",
            preview_image_url=preview,
            items=[
                AIRecommendationItemDTO(category="Top", description="White structured shirt", color="white"),
                AIRecommendationItemDTO(category="Outerwear", description="Camel blazer", color="camel"),
                AIRecommendationItemDTO(category="Shoes", description="Brown loafers", color="brown"),
            ],
        ),
        AIRecommendationDTO(
            id=str(uuid4()),
            title="Minimal Night Out",
            rationale="Keeps the silhouette sharp with darker tones and one accent piece.",
            preview_image_url=preview,
            items=[
                AIRecommendationItemDTO(category="Top", description="Black fitted tee", color="black"),
                AIRecommendationItemDTO(category="Bottom", description="Slim charcoal trousers", color="charcoal"),
                AIRecommendationItemDTO(category="Shoes", description="White sneakers", color="white"),
            ],
        ),
        AIRecommendationDTO(
            id=str(uuid4()),
            title="Weekend Layered Look",
            rationale="Adds texture and depth while staying relaxed and wearable.",
            preview_image_url=preview,
            items=[
                AIRecommendationItemDTO(category="Top", description="Ribbed knit polo", color="cream"),
                AIRecommendationItemDTO(category="Bottom", description="Light blue jeans", color="blue"),
                AIRecommendationItemDTO(category="Accessory", description="Tan crossbody bag", color="tan"),
            ],
        ),
    ]
