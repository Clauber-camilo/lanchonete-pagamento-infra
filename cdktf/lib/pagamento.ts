import { Construct } from "constructs";
import { Fn, TerraformOutput } from "cdktf";
import { Subnet } from "@cdktf/provider-aws/lib/subnet";
import { InternetGateway } from "@cdktf/provider-aws/lib/internet-gateway";
import { RouteTable } from "@cdktf/provider-aws/lib/route-table";
import { RouteTableAssociation } from "@cdktf/provider-aws/lib/route-table-association";
import { SecurityGroup } from "@cdktf/provider-aws/lib/security-group";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { Alb } from "@cdktf/provider-aws/lib/alb";
import { AlbTargetGroup } from "@cdktf/provider-aws/lib/alb-target-group";
import { LbListener } from "@cdktf/provider-aws/lib/lb-listener";
import { EcsCluster } from "@cdktf/provider-aws/lib/ecs-cluster";
import { EcsTaskDefinition } from "@cdktf/provider-aws/lib/ecs-task-definition";
import { EcsService } from "@cdktf/provider-aws/lib/ecs-service";
// import { DbSubnetGroup } from "@cdktf/provider-aws/lib/db-subnet-group";
import { CloudwatchLogGroup } from "@cdktf/provider-aws/lib/cloudwatch-log-group";
// import { DocdbCluster } from "@cdktf/provider-aws/lib/docdb-cluster";
// import { DocdbClusterInstance } from "@cdktf/provider-aws/lib/docdb-cluster-instance";

export class PagamentoConstruct extends Construct {
  constructor(
    scope: Construct,
    id: string,
    {
      mainVpc,
      prefix,
      dockerImage,
      containerDefinitions,
    }: {
      mainVpc: { id: string; cidrBlock: string };
      prefix: string;
      dockerImage: string;
      containerDefinitions?: string;
    }
  ) {
    super(scope, id);
    new AwsProvider(scope, "aws", { region: "us-east-1" });

    const zones = ["us-east-1a", "us-east-1b", "us-east-1c"];
    const createSubnet = (id: string, cidr: number) =>
      new Subnet(this, id, {
        vpcId: mainVpc.id,
        cidrBlock: Fn.cidrsubnet(mainVpc.cidrBlock, 8, cidr),
        mapPublicIpOnLaunch: true,
        availabilityZone: zones[cidr - 1],
        tags: { prefix },
      });

    const subnet1 = createSubnet("subnet1", 1);
    const subnet2 = createSubnet("subnet2", 2);
    const subnet3 = createSubnet("subnet3", 3);

    const igw = new InternetGateway(this, "igw", {
      vpcId: mainVpc.id,
      tags: { name: "main", prefix },
    });

    const routeTable = new RouteTable(this, "routeTable", {
      vpcId: mainVpc.id,
      route: [{ cidrBlock: "0.0.0.0/0", gatewayId: igw.id }],
    });

    new RouteTableAssociation(this, "routeTableAssociation1", {
      subnetId: subnet1.id,
      routeTableId: routeTable.id,
    });
    new RouteTableAssociation(this, "routeTableAssociation2", {
      subnetId: subnet2.id,
      routeTableId: routeTable.id,
    });
    new RouteTableAssociation(this, "routeTableAssociation3", {
      subnetId: subnet3.id,
      routeTableId: routeTable.id,
    });

    const mainSg = new SecurityGroup(this, "mainSG", {
      vpcId: mainVpc.id,
      name: `${prefix}-main-sg`,
      tags: { name: "main", prefix },
      ingress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
          description: "any",
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
          description: "any",
        },
      ],
    });

    const mongoURI = process.env.MONGO_URI;

    // Create an ECS cluster
    const ecsCluster = new EcsCluster(this, "ecsCluster", {
      name: `${prefix}-cluster`,
    });

    // Create a CloudWatch log group
    const logGroup = new CloudwatchLogGroup(this, "logGroup", {
      name: `${prefix}-log-group`,
      retentionInDays: 7,
    });

    // Create an ECS task definition
    const ecsTaskDefinition = new EcsTaskDefinition(this, "ecsTaskDefinition", {
      family: `${prefix}-task`,
      networkMode: "awsvpc",
      cpu: "256",
      memory: "512",
      requiresCompatibilities: ["FARGATE"],
      executionRoleArn: "arn:aws:iam::199750725241:role/LabRole",
      containerDefinitions:
        containerDefinitions ||
        Fn.jsonencode([
          {
            name: `${prefix}-container`,
            image: dockerImage, // replace with your Docker image
            essential: true,
            portMappings: [
              {
                containerPort: 8080,
                hostPort: 8080,
                protocol: "tcp",
              },
            ],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": logGroup.name,
                "awslogs-region": "us-east-1",
                "awslogs-stream-prefix": `${prefix}`,
              },
            },
            environment: [
              { name: "HTTP_PORT", value: "8080" },
              { name: "MONGO_URI", value: mongoURI },
              { name: "MONGO_DB", value: "fiap-lanchonete-pagamento" },
              { name: "MONGO_COLLECTION", value: "pagamento" },
              { name: "NATS_URL", value: "nats://66.51.121.86:4222" },
            ],
          },
        ]),
    });

    // Output the JDBC URL
    new TerraformOutput(this, "jdbc_url", {
      value: mongoURI,
      description: "Mongo URI",
    });

    // Create an Application Load Balancer
    const alb = new Alb(this, "alb", {
      name: `${prefix}-alb`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [mainSg.id],
      subnets: [subnet1.id, subnet2.id, subnet3.id],
    });

    // Create a target group for the ALB
    const albTargetGroup = new AlbTargetGroup(this, "albTargetGroup", {
      name: `${prefix}-target-group`,
      port: 8080,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: mainVpc.id,
      healthCheck: {
        enabled: true, // Enable health checks
        interval: 30, // The approximate amount of time, in seconds, between health checks of an individual target
        path: "/healthcheck", // The destination for the HTTP request
        protocol: "HTTP", // The protocol to use to connect with the target
        timeout: 5, // The amount of time, in seconds, during which no response means a failed health check
        healthyThreshold: 5, // The number of consecutive health checks successes required before considering an unhealthy target healthy
        unhealthyThreshold: 2, // The number of consecutive health check failures required before considering a target unhealthy
      },
    });

    // Create a listener for the ALB
    new LbListener(this, "lbListener", {
      loadBalancerArn: alb.arn,
      port: 8080,
      protocol: "HTTP",
      defaultAction: [
        {
          type: "forward",
          targetGroupArn: albTargetGroup.arn,
        },
      ],
    });
    //output public service dns to connect from anywhere
    new TerraformOutput(this, "service_dns", {
      value: alb.dnsName,
      description: "DNS name of the service",
    });

    // Create an ECS service
    new EcsService(this, "ecsService", {
      name: `${prefix}-service`,
      cluster: ecsCluster.id,
      taskDefinition: ecsTaskDefinition.arn,
      desiredCount: 1,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: [subnet1.id, subnet2.id, subnet3.id],
        securityGroups: [mainSg.id],
        assignPublicIp: true,
      },
      loadBalancer: [
        {
          targetGroupArn: albTargetGroup.arn,
          containerName: `${prefix}-container`,
          containerPort: 8080,
        },
      ],
    });
  }
}
