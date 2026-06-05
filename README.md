# Apigee AI Portal

The Apigee AI Portal is a modern, agent-centric storefront template designed for Google Cloud AI and API products. It provides a robust and flexible foundation for building sophisticated API developer portals that leverage the power of Google Cloud's AI ecosystem.

## Key Advantages

*   **Flexible Backend Options**: Deploy with ease using either **Cloud Run** for a serverless experience or as an **Apigee Proxy** for integrated API management.
*   **Seamless Integration**: Designed to integrate flawlessly with **Apigee X** and **Apigee hybrid** APIs, providing a unified management and discovery experience.
*   **Agentic Customization**: Built for high extensibility, the portal can be easily customized using **Antigravity**, **Gemini CLI**, or other agentic coding solutions, enabling rapid iteration and AI-driven development.
*   **Enterprise-Grade Monitoring**: Fully supported through **Google Cloud Monitoring**, ensuring you have deep visibility into portal performance and usage patterns.

## Getting Started

### Prerequisites

- Go 1.26.1 or later
- Google Cloud Project with Apigee and API Hub provisioned
- Google Cloud SDK (gcloud) installed and authenticated

### Cloud Shell Lab
Use this lab to walk through the deployment.

[![Open in Cloud Shell](https://gstatic.com/cloudssh/images/open-btn.png)](https://ssh.cloud.google.com/cloudshell/open?cloudshell_git_repo=https://github.com/gcp-samples/apigee-ai-portal&cloudshell_git_branch=main&cloudshell_workspace=.&cloudshell_tutorial=docs/TUTORIAL_PROXY.md)

### Deployment

You can use the provided deployment scripts in the `sh/` directory:

```bash
# Setup the environment (Initializes API Hub attributes)
./sh/setup.sh

# Deploy to Cloud Run
./sh/deploy.sh
```

## Customization

The portal is designed to be easily themed and extended. You can create new themes or modify existing ones using AI agents to match your brand and functional requirements. For automated modifications, tools like **Gemini CLI** are highly recommended.

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.
