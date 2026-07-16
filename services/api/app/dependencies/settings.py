from typing import Annotated

from fastapi import Depends

from app.core.settings import ApiSettings, get_settings

Settings = Annotated[ApiSettings, Depends(get_settings)]
