import vertexai
from google.cloud import aiplatform

def list_models():
    # Initialize with the project ID from your JSON
    project_id = "project-048abb9f-c292-4139-82e"
    location = "us-central1"
    
    import google.auth
    
    try:
        credentials, project = google.auth.default()
        print(f"Auth detected project: {project}")
        print(f"Service Account Email: {credentials.service_account_email if hasattr(credentials, 'service_account_email') else 'Unknown'}")
        
        from vertexai.generative_models import GenerativeModel
        vertexai.init(project=project_id, location=location)
        
        print(f"\nChecking models for project: {project_id} in {location}...")
        
        # Check locations
        print("Checking available locations...")
        from google.cloud import aiplatform_v1
        client = aiplatform_v1.EndpointServiceClient(client_options={"api_endpoint": "us-central1-aiplatform.googleapis.com"})
        # Actually better to use the base client
        from google.api_core.client_options import ClientOptions
        
        # Try to list locations to see where Vertex AI is enabled
        print("Listing available locations for this project...")
        # Note: This might fail if API is disabled
        from google.cloud import resourcemanager_v3
        
        # Simple test: Can we even list regions?
        # Use vertexai directly
        from vertexai.generative_models import GenerativeModel
        
        if not success:
            print("\n[FAIL] None of the common model versions worked.")
    except Exception as e:
        print(f"\n[ERROR] Connection failed:")
        print(f"Details: {e}")
        if "403" in str(e):
            print("\nSuggestion: Your service account might be missing the 'Vertex AI User' role.")
        elif "404" in str(e):
            print("\nSuggestion: The Vertex AI API is likely not enabled, or the region 'us-central1' is incorrect.")
        print("\nEnable Link: https://console.cloud.google.com/flows/enableapi?apiid=aiplatform.googleapis.com")

if __name__ == "__main__":
    list_models()
