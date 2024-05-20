# Lanchonete Pagamento Infra

This project uses Terraform CDK (cdktf) to manage AWS resources.

## Description

This project has the responsability to create the infrastructure
to the Lanchonete Pagamento project.

This will load the docker-image generate by the build process of the [repository](https://github.com/Clauber-camilo/lanchonete-pagamento) and deploy it to the AWS ECS.

## Prerequisites

- Node.js
- AWS account
- Terraform CDK

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Clauber-camilo/lanchonete-pagamento-infra
   ```
2. Navigate to the project directory:
   ```bash
   cd lanchoete-pagamento-infra
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```

## Usage

1. Generate Terraform configuration:
   ```bash
   npx cdktf-cli synth
   ```
2. Deploy the infrastructure:
   ```bash
   npx cdktf-cli deploy
   ```
