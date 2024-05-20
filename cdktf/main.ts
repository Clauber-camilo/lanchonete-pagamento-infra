import { App, S3Backend, TerraformStack } from "cdktf";
import { PagamentoConstruct } from "./lib/pagamento";
import { Construct } from "constructs";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Vpc } from "@cdktf/provider-aws/lib/vpc";

class DevStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(scope, "aws", { region: "us-east-1" });

    const mainVpc = new Vpc(this, "vpc", {
      cidrBlock: "10.0.0.0/16",
      enableDnsHostnames: true,
      tags: { name: "main", prefix: "development" },
    });

    new PagamentoConstruct(this, "lanchonete", {
      mainVpc: mainVpc,
      prefix: "pagamento",
      dockerImage: "camiloclauber/pagamento:main",
    });
  }
}

const app = new App();
const devStack = new DevStack(app, "development");

new S3Backend(devStack, {
  key: "terraform/terraform.state",
  bucket: "lanchonete-pagamento",
  region: "us-east-1",
});

app.synth();
