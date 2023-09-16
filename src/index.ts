import {
  $query,
  $update,
  Record,
  StableBTreeMap,
  Vec,
  match,
  Result,
  nat64,
  ic,
} from "azle";
import { v4 as uuidv4, validate as isValidUUID } from "uuid";

// Define a type for a package holder
type PackageHolder = Record<{
  uuid: string;
  name: string;
}>;

// Define a type for a package
//TODO fix with enum if possible
//type PackageStatus = "processing" | "in transit" | "delivered";

const packageStatusStrings = {
  PROCESSING: "processing",
  IN_TRANSIT: "in transit",
  DELIVERED: "delivered",
};

// Define a type for history with package holder and current timestamp
type PackageHolderWithTimestamp = Record<{
  packageHolder: PackageHolder;
  timestamp: nat64;
}>;

type Package = Record<{
  id: string;
  status: string;
  sender: PackageHolder;
  recipient: PackageHolder;
  currentPackageHolder: PackageHolder;
  deliveryHistory: Vec<PackageHolderWithTimestamp>;
  createdAt: nat64;
}>;

// Define storage for packages
const packageStorage = new StableBTreeMap<string, Package>(0, 44, 1024);

// Define storage for package holders
const packageHolderStorage = new StableBTreeMap<string, PackageHolder>(
  1,
  44,
  1024,
);

// Function to create a new package holder
$update;

export function createPackageHolder(
  name: string,
): Result<PackageHolder, string> {
  if (!name) {
    return Result.Err("Name is required.");
  }

  const existingPackageHolder = Array.from(packageHolderStorage.values()).find(
    (holder) => holder.name === name,
  );
  if (existingPackageHolder) {
    return Result.Err("A PackageHolder with the same name already exists.");
  }

  const packageHolderUUID = uuidv4();
  const newPackageHolder: PackageHolder = {
    uuid: packageHolderUUID,
    name,
  };

  try {
    packageHolderStorage.insert(packageHolderUUID, newPackageHolder);
    return Result.Ok(newPackageHolder);
  } catch (error) {
    return Result.Err("Failed to insert package holder.");
  }
}

// Function to get a package holder by UUID
$query;

export function getPackageHolderById(
  uuid: string,
): Result<PackageHolder, string> {
  if (!isValidUUID(uuid)) {
    return Result.Err("Invalid package holder UUID.");
  }

  return match(packageHolderStorage.get(uuid), {
    Some: (packageHolderFound) =>
      Result.Ok<PackageHolder, string>(packageHolderFound),
    None: () => Result.Err<PackageHolder, string>("Package holder not found."),
  });
}

$query;
export function getAllPackageHolders(): Result<Vec<PackageHolder>, string> {
  try {
    return Result.Ok(packageHolderStorage.values());
  } catch (error) {
    return Result.Err(`Failed to fetch packageHolders: ${error}`);
  }
}

// Function to create a new package with sender, recipient, and the first delivery person
$update;

export function createPackage(
  senderId: string,
  recipientId: string,
  firstDeliveryPersonId: string,
): Result<Package, string> {
  if (!senderId || !recipientId || !firstDeliveryPersonId) {
    return Result.Err(
      "Sender, recipient, and first delivery person ids are required.",
    );
  }

  if (
    !isValidUUID(senderId) ||
    !isValidUUID(recipientId) ||
    !isValidUUID(firstDeliveryPersonId)
  ) {
    return Result.Err(
      "Invalid sender, recipient, or first delivery person ID.",
    );
  }

  const packageHolders = [
    { id: senderId, name: "sender" },
    { id: recipientId, name: "recipient" },
    { id: firstDeliveryPersonId, name: "first delivery person" },
  ];

  for (const holder of packageHolders) {
    const packageHolder = getPackageHolderById(holder.id);

    if (!packageHolder || !packageHolder.Ok || packageHolder.Err) {
      return Result.Err<Package, string>(
        `Could not update package with the holder id=${holder.id}. Package holder not found!`,
      );
    }
  }

  const currentTimestamp = ic.time();

  const packageId = uuidv4();
  const newPackage: Package = {
    id: packageId,
    sender: { uuid: senderId, name: "sender" }, // Create the sender object
    recipient: { uuid: recipientId, name: "recipient" }, // Create the recipient object
    status: packageStatusStrings.PROCESSING,
    currentPackageHolder: {
      uuid: firstDeliveryPersonId,
      name: "first delivery person",
    }, // Create the currentPackageHolder object
    deliveryHistory: [
      {
        packageHolder: { uuid: senderId, name: "sender" }, // Create the sender object
        timestamp: currentTimestamp,
      },
      {
        packageHolder: {
          uuid: firstDeliveryPersonId,
          name: "first delivery person",
        }, // Create the currentPackageHolder object
        timestamp: currentTimestamp,
      },
    ],
    createdAt: currentTimestamp,
  };

  try {
    packageStorage.insert(packageId, newPackage);
  } catch (error) {
    return Result.Err<Package, string>(
      `Error inserting package into packageStorage: ${error}`,
    );
  }

  return Result.Ok(newPackage);
}

// Function to get a package by ID
$query;

export function getPackageById(packageId: string): Result<Package, string> {
  if (!isValidUUID(packageId)) {
    return Result.Err("Invalid package ID.");
  }

  return match(packageStorage.get(packageId), {
    Some: (packageFound) => Result.Ok<Package, string>(packageFound),
    None: () => Result.Err<Package, string>("Package not found."),
  });
}

// Function to update the package holder and/or status
$update;

export function updatePackage(
  packageId: string,
  newPackageHolderId: string,
): Result<Package, string> {
  if (!isValidUUID(packageId) || !isValidUUID(newPackageHolderId)) {
    return Result.Err("Invalid package ID or package holder ID.");
  }

  const newPackageHolder = getPackageHolderById(newPackageHolderId);

  if (!newPackageHolder || !newPackageHolder.Ok || newPackageHolder.Err) {
    return Result.Err<Package, string>(
      `Could not update package with the new holder id=${newPackageHolderId}. Package holder not found!`,
    );
  }

  const existingPackage = getPackageById(packageId);

  if (!existingPackage || !existingPackage.Ok || existingPackage.Err) {
    return Result.Err<Package, string>(
      `Could not update package with the given id=${packageId}. Package not found!`,
    );
  }

  // Step 1: Set the updated status to "in transit"
  let updatedStatus = packageStatusStrings.IN_TRANSIT;

  // Check if the current package holder is the same as the recipient
  if (
    existingPackage.Ok.currentPackageHolder.uuid ===
    existingPackage.Ok.recipient.uuid
  ) {
    updatedStatus = packageStatusStrings.DELIVERED;
  }

  // Step 2: Create a new delivery history entry
  const newDeliveryHistoryEntry = {
    packageHolder: newPackageHolder.Ok,
    timestamp: ic.time(),
  };

  // Step 3: Create the updated package object
  const updatedPackage: Package = {
    ...existingPackage.Ok,
    status: updatedStatus, // Update the status after first package holder to "in transit" or to "delivered" if applicable
    currentPackageHolder: newPackageHolder.Ok, // Update the current package holder
    deliveryHistory: [
      ...existingPackage.Ok.deliveryHistory,
      newDeliveryHistoryEntry,
    ],
  };

  // Step 4: Update the package in storage
  try {
    packageStorage.insert(packageId, updatedPackage);
  } catch (error) {
    return Result.Err<Package, string>(
      `Error inserting updatedPackage into packageStorage: ${error}`,
    );
  }

  // Step 5: Return the updated package as a Result.Ok
  return Result.Ok(updatedPackage);
}


globalThis.crypto = {
    //@ts-ignore
    getRandomValues: () => {
      let array = new Uint8Array(32);
  
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
  
      return array;
    },
  };
  