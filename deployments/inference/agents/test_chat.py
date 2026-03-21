"""Terminal chat client for the Recolorization Agent.

Usage:
    # Terminal 1 — start the server
    cd deployments/inference/agents
    python server.py

    # Terminal 2 — start the chat
    python test_chat.py

Commands during chat:
    image <path>   Attach an image (e.g. 'image ../test_image_resized.png')
    save           Save the last result image to disk
    quit           Exit
"""

import base64
import requests
from pathlib import Path

BASE_URL = "http://localhost:8001"
session_id = None
last_result_b64 = None
last_recolor_count = 0


def chat(message: str, image_path: str = None) -> dict:
    global session_id
    payload = {"message": message, "session_id": session_id}
    if image_path:
        print("Chatting with image")
        with open(image_path, "rb") as f:
            payload["image_base64"] = base64.b64encode(f.read()).decode()
        payload["image_filename"] = Path(image_path).name
    print("Requesting chat...")
    r = requests.post(f"{BASE_URL}/agent/chat", json=payload, timeout=300)
    r.raise_for_status()
    return r.json()


def select_palette(index: int) -> dict:
    r = requests.post(
        f"{BASE_URL}/agent/chat/{session_id}/select-palette/{index}",
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def save_result(b64: str, count: int):
    path = f"result_{count}.png"
    with open(path, "wb") as f:
        f.write(base64.b64decode(b64))
    print(f"  Saved: {path}")


def print_palette(colors: list[list[int]]):
    hex_colors = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors]
    print(f"  Palette: {' '.join(hex_colors)}")


def main():
    global session_id, last_result_b64, last_recolor_count

    print("Recolorization Agent Chat")
    print("  'image <path>'  — attach an image")
    print("  'pick <n>'      — select from multiple palette candidates")
    print("  'save'          — save last result image")
    print("  'quit'          — exit")
    print("-" * 50)

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        if user_input.lower() == "quit":
            break

        # save command
        if user_input.lower() == "save":
            if last_result_b64:
                save_result(last_result_b64, last_recolor_count)
            else:
                print("  No result yet.")
            continue

        # pick palette candidate
        if user_input.lower().startswith("pick "):
            try:
                idx = int(user_input.split()[1])
                data = select_palette(idx)
                print(f"  Selected palette [{idx}]: {data['description']}")
                print_palette(data["palette"])
            except Exception as e:
                print(f"  Error: {e}")
            continue

        # image attachment
        image_path = None
        if user_input.lower().startswith("image "):
            parts = user_input[6:].strip().split(None, 1)
            image_path = parts[0]
            if not Path(image_path).exists():
                print(f"  File not found: {image_path}")
                continue
            user_input = parts[1] if len(parts) > 1 else "I have uploaded an image."

        try:
            data = chat(user_input, image_path)
        except requests.exceptions.ConnectionError:
            print("  Cannot connect — is the server running? (python server.py)")
            continue
        except Exception as e:
            print(f"  Error: {e}")
            continue

        session_id = data["session_id"]

        print(f"\nAgent: {data['response']}")

        if data.get("has_palette") and data.get("palette"):
            print_palette(data["palette"])

        if data.get("palette_candidates"):
            candidates = data["palette_candidates"]
            if len(candidates) > 1:
                print(f"  {len(candidates)} palette candidates:")
                for i, c in enumerate(candidates):
                    hex_colors = [
                        f"#{r:02x}{g:02x}{b:02x}" for r, g, b in c["colors"]
                    ]
                    print(f"    [{i}] {c.get('description', '')} — {' '.join(hex_colors)}")
                print("  Use 'pick <n>' to select one.")

        if data.get("result_base64"):
            last_result_b64 = data["result_base64"]
            last_recolor_count = data.get("recolor_count", 0)
            save_result(last_result_b64, last_recolor_count)

        if data.get("error"):
            print(f"  Error: {data['error']}")


if __name__ == "__main__":
    main()
