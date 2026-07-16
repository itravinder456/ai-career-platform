from typing import Annotated

from fastapi import Depends

from core.config import AppSettings, get_settings

Settings = Annotated[AppSettings, Depends(get_settings)]
