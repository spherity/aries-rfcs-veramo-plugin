# Documentation Aries Plugin

# Aries RFCs Veramo Plugin

A DIDComm [`MessageHandlerPlugin`](https://github.com/uport-project/veramo/tree/next/packages/message-handler) plugin for the Veramo agent enabling it to send and handle DIDComm messages using the Hyperledger [`AriesRFCs`](https://github.com/uport-project/veramo/tree/next/packages/credential-status) workflows.[`@spherity/aries-rfcs-veramo-plugin`](https://github.com/spherity/aries-rfcs-veramo-plugin) contain message handlers that are based on aries flows and also contains methods that allow the initiation of those Aries Flows.

### Supported Flows

- Did Exchange 0023
- Issue Credential v2 0453
- Present Proof v2 0454

## Setup

1. Install this plugin

   ```
   npm install --save @spherity/aries-rfcs-veramo-plugin @veramo/message-handler

   ```

2. Add the plugin to your agent

   ```tsx
   import { MessageHandler } from '@veramo/message-handler';
   import {
   	IssueCredential0453MessageHandler,
   	PresentProof0454MessageHandler,
   	DidExchange0023MessageHandler
   } from 'aries-veramo-plugin';
   ...

   export const veramoAgent = createAgent<VeramoAgent>({
     ...,
     plugins: [
       new MessageHandler({
         messageHandlers: [
           new DIDCommMessageHandler(),
           new DidExchange0023MessageHandler(trustResolver),
           new IssueCredential0453MessageHandler(
   					CreateCredentialCallback(),
   					ReceiveCredentialCallback()
   				),
           new PresentProof0454MessageHandler(
   					CreatePresentationCallback(),
   					VerifyPresentationCallback()
   				),
         ],
       }),
   	],
   });

   ```

## Usage

### MessageHandlers

- **DidExchange0023MessageHandler**

  The `DidExchange0023MessageHandler` supports the [`Aries RFC 0023`](https://github.com/hyperledger/aries-rfcs/tree/main/features/0023-did-exchange#implicit-and-explicit-invitations) flows. It allows the user to send and handle messages within that specific protocol, it requires a `trustresolver` instance with a method of `checkTrustStatus` as a parameter.

  **Sample TrustResolver**

  ```tsx
  export class TrustResolver {
  	const trusted = [...]
  	async checkTrustStatus(did: string): Promise<boolean> {
      try {
        const trustStatus = trusted.includes(did)
        return trustStatus
      } catch (e) {
        return false;
      }
    }
  }
  ```

- **IssueCredential0453MessageHandler**
  The `IssueCredential0453MessageHandler` supports the [`Aries RFC 0453`](https://github.com/hyperledger/aries-rfcs/tree/main/features/0453-issue-credential-v2) flows. It allows the user to send and handle messages within that specific protocol, it requires callback functions, for Creating a Credential and Receiving a Credential.
  **Create Credential Callback**
  The parameters for the callback for `createCredential` are `credentialData` , `issuerDid` , `recipientDid`, `veramoAgent`. The response from the `createCredential` callback should be a `Veramo CreateVerifiableCredential` Response.
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  public async createCredential(
  	credentialData: any,
  	issuerDid: string,
  	recipientDid: string,
  	veramoAgent: VeramoAgent
  ) {
  	const createdAt = new Date();
    const expiresAt = credentialData.expirationDate
      ? new Date(credentialData.expirationDate)
      : new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 365);

  	const credentialPayload: CredentialPayload = {
      id: credentialData.credentialId,
      issuer: issuerDid,
      '@context': [...],
      expirationDate: expiresAt.toISOString(),
      issuanceDate: issuesAt.toISOString(),
      credentialSubject: {
        id: recipientDid,
        ...credentialData.data,
      },
    };

  	vc = await veramoAgent.createVerifiableCredential(
      {
        credential: credentialPayload,
        proofFormat: 'lds',
        now: nowOverride,
      },
      { agent: veramoAgent.agent } as any,
    );

    return vc;
  }
  ```

  ********\*\*\*\*********ReceiveCredentialCallback********\*\*\*\*********

  The parameters for the callback for `receiveCredential` are `fromDid`, `credential`, `message` (contains the credential offer message sent by the issuer to receiver). There is no expected response from the `receiveCredential` .

  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  private async receiveCredential(fromDid: string, credential: any, message: any) {
    const recipientIdentifier = await identifier.findFirst({
      where: {
        did: fromDid,
      },
    });

    if (!recipientIdentifier) {
      throw new Error(`Identifier with did<${fromDid}> is not found`);
    }

     // save credential in the database
  }
  ```

- **PresentProof0454MessageHandler**
  The `PresentProof0454MessageHandler` supports the [`Aries RFC 0454`](https://github.com/hyperledger/aries-rfcs/tree/main/features/0454-present-proof-v2) flows. It allows the user to send messages within that specific protocol, it requires callback functions for Creating a Presentation and Verifying a Presentation.
  **Create Presentation Callback**
  The parameters for the callback for `createPresentation` are `holderDid` , `veramoAgent`, `credentialType`. The response from the `createPresentation` callback can be anything from the `presentation` to the `jwt` as long .
  
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  private async createPresentation(
  	holderDid: string,
  	credentialType: CredentialType,
  	veramoAgent: VeramoAgent
  ) {

    const credential = // retrieve credential from the database
    const presentation = await veramoAgent.createVerifiablePresentation(
      {
        presentation: {
          verifiableCredential: [credential as W3CVerifiableCredential],
          holder: holderDid,
        },
        proofFormat: 'jwt',
      },
      {} as any,
    );

    return presentation;
  }
  ```
  **Verify Presentation Callback**
  The parameters for the callback for `verifyPresentation` are `verifiablePresentation` , `veramoAgent`. The response from the `verifyPresentation` needs to be a `boolean` otherwise a `Problem Report` will be sent to the other party.
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  private async verifyPresentation(verifiablePresentation: any, veramoAgent: VeramoAgent) {
    const verificationResponse = await veramoAgent.verifyPresentation(
      {
        presentation: verifiablePresentation,
        // We only want to check the signature and its general validity
        // The rest we handle manually to throw the correct OCI error codes
        policies: {
          issuanceDate: false,
          expirationDate: false,
          aud: false,
        },
      },
      {} as any,
    );

    return verificationResponse;
  }
  ```

### Sending Messages

- ****\*\*\*\*****Send0023 (Invitation)****\*\*\*\*****
  The method `send0023` method of the `AriesRFCsPlugin` can be used to initiate the `Aries RFC 0023` Protocol. It requires an object of type `Send0023MessageAttr` and `IContext` (Veramo Context) and returns an an object of type `SendRFCsResponse`.
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  import { AriesRFCsPlugin } from 'aries-veramo-plugin';

  ********const ariesPlugin = new AriesRFCsPlugin;

  await ariesPlugin.send0023(
  	{
  		to: //Receiver DID
  		from: // Sender DID
  	},
  	{ VeramoContext }
  );
  ```
- ****\*\*\*\*****Send0453 (Issue Credential)****\*\*\*\*****
  The method `send0453` method of the `AriesRFCsPlugin` can be used to initiate the `Aries RFC 0453` Protocol. It requires an object of type `Send0453MessageAttr` and `IContext` (Veramo Context) and returns an an object of type `SendRFCsResponse`.
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  import {
  	AriesRFCsPlugin,
  	MESSAGE_TYPES_0453,
  	DIDCommMessagePacking
  } from 'aries-veramo-plugin';

  ********const ariesPlugin = new AriesRFCsPlugin;

  await ariesPlugin.send0453(
  	{
  		to: //Receiver DID
  		from: // Sender DID
  		type: // MESSAGE_TYPES_0453
  		packingType: // DIDCommMessagePacking
  		message: {
  			'@type': // MESSAGE_TYPE_0453
  			credentialBody: {...}
  		}
  	},
  	{ VeramoContext }
  );
  ```
- ****\*\*\*\*****Send0454 (Present Proof)****\*\*\*\*****
  The method `send0454` method of the `AriesRFCsPlugin` can be used to initiate the `Aries RFC 0454` Protocol. It requires an object of type `Send0454MessageAttr` and `IContext` (Veramo Context) and returns an an object of type `SendRFCsResponse`.
  ****\*\*\*\*****Sample****\*\*\*\*****
  ```tsx
  import {
  	AriesRFCsPlugin,
  	MESSAGE_TYPES_0454,
  	DIDCommMessagePacking
  } from 'aries-veramo-plugin';

  ********const ariesPlugin = new AriesRFCsPlugin;

  await ariesPlugin.send0454(
  	{
  		to: //Receiver DID
  		from: // Sender DID
  		type: // MESSAGE_TYPES_0454
  		packingType: // DIDCommMessagePacking
  		message: {
  			'@type': // MESSAGE_TYPE_0454
  		}
  	},
  	{ VeramoContext }
  );
  ```
