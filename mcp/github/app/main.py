from .registry import register_tools
from .server import server


def main() -> None:
    register_tools()
    server.run()


if __name__ == "__main__":
    main()
