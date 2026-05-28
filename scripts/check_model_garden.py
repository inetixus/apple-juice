import os
from google.cloud import aiplatform_v1

def main():
    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "project-048abb9f-c292-4139-82e")
    model_id = "text-bison@001"
    name = f"publishers/google/models/{model_id}"

    client = aiplatform_v1.ModelGardenServiceClient()
    try:
        pm = client.get_publisher_model(name=name)
        print("FOUND")
        print("name:", pm.name)
        # Print a couple non-sensitive fields if present
        if getattr(pm, "display_name", None):
            print("display_name:", pm.display_name)
        if getattr(pm, "publisher_model_template", None):
            print("template_preview:", pm.publisher_model_template[:200])
    except Exception as e:
        print("ERROR", type(e).__name__, e)

if __name__ == '__main__':
    main()
