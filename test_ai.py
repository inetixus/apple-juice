import vertexai
from vertexai.generative_models import GenerativeModel

# Initialize Vertex AI with your project ID
# Replace 'project-048abb9f-c292-4139-82e' with your actual project ID if it differs
vertexai.init(project="project-048abb9f-c292-4139-82e", location="global")

# Updated for May 2026 model version
model = GenerativeModel("gemini-3-flash-preview")

def generate_text():
    response = model.generate_content("Say 'The apple juice is ready' if you can hear me!")
    print(response.text)

if __name__ == "__main__":
    generate_text()