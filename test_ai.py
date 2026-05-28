import vertexai
from vertexai.generative_models import GenerativeModel

# Initialize Vertex AI with your project ID
# Replace 'project-048abb9f-c292-4139-82e' with your actual project ID if it differs
vertexai.init(project="project-048abb9f-c292-4139-82e", location="us-central1")

# You can change this to "claude-3-5-haiku@20241022" if you enabled it in Model Garden
model = GenerativeModel("claude-3-5-haiku@20241022")

def generate_text():
    response = model.generate_content("Say 'The apple juice is ready' if you can hear me!")
    print(response.text)

if __name__ == "__main__":
    generate_text()